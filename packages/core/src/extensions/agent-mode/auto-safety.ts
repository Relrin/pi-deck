/**
 * Deterministic safety rules for `auto` agent mode.
 *
 * In `auto` the agent runs edits and shell commands without prompting so long tasks aren't
 * constantly interrupted; this module is the safety net that decides which calls are risky
 * enough to pause for approval. It is a pure, conservative rule engine (no IO, no network, no
 * LLM) mirroring the style of `bash-safety.ts`: it only flags shapes it can positively match as
 * dangerous and otherwise returns "not risky", so ordinary work (`npm test`, `git commit`,
 * in-project writes) flows through untouched.
 *
 * Potential risks include:
 *  - mass / forced deletion and filesystem destruction
 *  - privilege escalation, power control, fork bombs
 *  - remote-pipe-to-shell (e.g. `curl ... | sh`)
 *  - data exfiltration (outbound network tools uploading files / touching secrets)
 *  - writes to secret/credential files or to paths outside the workspace
 *
 * MCP tools are handled separately (gated by approval, see the `isMcpToolCall` helpers) because
 * we can't introspect an external tool's behavior the way we can a shell command.
 */

import { isAbsolute, normalize, resolve, sep } from "node:path";
import { commandTokens, splitSegments, tokenize } from "./bash-safety.js";

export type AutoRisk = { risky: true; reason: string } | { risky: false };

const SAFE: AutoRisk = { risky: false };

/**
 * Assess whether a non-read-only tool call is risky enough to pause for approval in auto mode.
 * Read-only tool calls (handled by the caller) never reach here; unknown/MCP tools are handled
 * by the caller too. Returns `{ risky: false }` for anything we can't positively flag.
 */
export function assessAutoModeRisk(
  toolName: string,
  input: unknown,
  projectPath: string,
): AutoRisk {
  if (toolName === "bash" || toolName === "shell") return assessBashRisk(input);
  if (toolName === "edit" || toolName === "write") return assessWriteRisk(input, projectPath);
  return SAFE;
}

// ---------------------------------------------------------------------------------------------
// MCP helpers (the proxy `mcp` tool plus any direct-exposed MCP tools whose names we were told)
// ---------------------------------------------------------------------------------------------

/** Whether a tool call targets MCP - the `mcp` proxy or a known direct-exposed MCP tool. */
export function isMcpToolCall(toolName: string, mcpToolNames?: ReadonlySet<string>): boolean {
  return toolName === "mcp" || (mcpToolNames?.has(toolName) ?? false);
}

/**
 * Whether an `mcp` proxy call is a read-only *discovery* op (search / list / describe) rather than
 * an actual tool invocation. Discovery flows through in auto mode; invocations (and anything we
 * can't prove is discovery, e.g. `connect` / `auth-start`) are gated. Direct-exposed MCP tools are
 * never discovery — they're always real invocations.
 */
export function isMcpDiscovery(input: unknown): boolean {
  if (typeof input !== "object" || input === null) return false;
  const o = input as Record<string, unknown>;
  if (typeof o.tool === "string" && o.tool.length > 0) return false; // invoking a tool
  if (typeof o.search === "string") return true;
  const action = typeof o.action === "string" ? o.action : undefined;
  return action === "list" || action === "describe" || action === "search";
}

/** Approval reason shown on the pill when an MCP invocation is gated in auto mode. */
export function mcpApprovalReason(toolName: string, input: unknown): string {
  return `Auto mode: run MCP tool ${mcpToolLabel(toolName, input)}? It runs outside the workspace and can't be safety-checked — allow it, or deny to skip.`;
}

function mcpToolLabel(toolName: string, input: unknown): string {
  if (toolName !== "mcp") return `\`${toolName}\``;
  if (typeof input === "object" && input !== null) {
    const tool = (input as { tool?: unknown }).tool;
    if (typeof tool === "string" && tool) return `\`${tool}\``;
    const action = (input as { action?: unknown }).action;
    if (typeof action === "string" && action) return `action \`${action}\``;
  }
  return "`mcp`";
}

// ---------------------------------------------------------------------------------------------
// Shell-command rules
// ---------------------------------------------------------------------------------------------

/** Interpreters that, when a downloader pipes into them, mean "run code fetched from the net". */
const SHELL_INTERPRETERS: ReadonlySet<string> = new Set([
  "sh",
  "bash",
  "zsh",
  "dash",
  "ksh",
  "fish",
  "python",
  "python2",
  "python3",
  "node",
  "deno",
  "bun",
  "perl",
  "ruby",
  "php",
  "iex", // PowerShell Invoke-Expression alias
]);

/** Downloaders whose output, piped into an interpreter, is remote-code-execution. */
const DOWNLOADERS: ReadonlySet<string> = new Set([
  "curl",
  "wget",
  "fetch",
  "iwr", // PowerShell Invoke-WebRequest alias
]);

/** Raw network tools used for exfiltration; gated whenever they appear in a non-read-only command. */
const RAW_NETWORK_TOOLS: ReadonlySet<string> = new Set([
  "nc",
  "ncat",
  "netcat",
  "telnet",
  "ftp",
  "tftp",
]);

/** Remote file-copy tools; gated when an arg looks like a remote `host:path` target. */
const REMOTE_COPY_TOOLS: ReadonlySet<string> = new Set(["scp", "sftp", "rsync"]);

function assessBashRisk(input: unknown): AutoRisk {
  const command = extractCommand(input);
  if (!command) return SAFE;

  // Whole-command signatures that survive tokenization poorly.
  if (isForkBomb(command)) {
    return {
      risky: true,
      reason: "Auto mode: this looks like a fork bomb - denied unless you allow it.",
    };
  }
  if (/>\s*\/dev\/(sd|nvme|hd|vd|disk|mapper)/i.test(command)) {
    return {
      risky: true,
      reason:
        "Auto mode: this redirects output onto a block device, which can destroy a disk - allow it, or deny.",
    };
  }

  const segments = splitSegments(command)
    .map((segment) => commandTokens(tokenize(segment)))
    .filter((parsed): parsed is { cmd: string; args: string[] } => parsed !== undefined);

  for (const { cmd, args } of segments) {
    const reason = dangerousSegment(cmd, args);
    if (reason) return { risky: true, reason };
  }

  const pipeReason = remotePipeToShell(segments);
  if (pipeReason) return { risky: true, reason: pipeReason };

  return SAFE;
}

function dangerousSegment(cmd: string, args: readonly string[]): string | undefined {
  // Mass / forced deletion.
  if (cmd === "rm") {
    if (isRecursive(args) || args.some(isBroadTarget)) {
      return "Auto mode: this deletes files recursively or targets a broad path - allow it, or deny to stop.";
    }
  }
  if (cmd === "rmdir" || cmd === "rd") {
    if (args.some((a) => /^\/s$/i.test(a))) return windowsDeleteReason();
  }
  if (cmd === "del" || cmd === "erase") {
    if (args.some((a) => /^\/[sq]$/i.test(a)) || args.some(isBroadTarget))
      return windowsDeleteReason();
  }

  // Filesystem destruction.
  if (/^mkfs(\.|$)/.test(cmd) || cmd === "shred" || cmd === "wipefs" || cmd === "blkdiscard") {
    return "Auto mode: this can destroy a filesystem - allow it, or deny to stop.";
  }
  if (cmd === "format" || cmd === "diskpart") return windowsDeleteReason();
  if (cmd === "dd" && args.some((a) => a.startsWith("of="))) {
    return "Auto mode: `dd` is writing to a device/file, which can be destructive - allow it, or deny.";
  }

  // Permission / ownership sweeps over broad paths.
  if (
    (cmd === "chmod" || cmd === "chown" || cmd === "chgrp") &&
    isRecursive(args) &&
    args.some(isBroadTarget)
  ) {
    return "Auto mode: this recursively changes permissions/ownership over a broad path - allow it, or deny.";
  }

  // Privilege escalation.
  if (cmd === "sudo" || cmd === "doas" || cmd === "su") {
    return "Auto mode: this runs with elevated privileges - allow it, or deny to stop.";
  }

  // Power control.
  if (cmd === "shutdown" || cmd === "reboot" || cmd === "halt" || cmd === "poweroff") {
    return "Auto mode: this powers off or reboots the machine - allow it, or deny.";
  }
  if (cmd === "init" && (args.includes("0") || args.includes("6"))) {
    return "Auto mode: this powers off or reboots the machine - allow it, or deny.";
  }

  // Kill everything.
  if (cmd === "kill" && args.includes("-1")) {
    return "Auto mode: this signals every process - allow it, or deny to stop.";
  }

  // Raw network tools — classic exfiltration channels.
  if (RAW_NETWORK_TOOLS.has(cmd)) {
    return "Auto mode: this opens a raw network connection that could exfiltrate data - allow it, or deny.";
  }

  // Outbound uploads via curl/wget.
  if (DOWNLOADERS.has(cmd) && isUpload(args)) {
    return "Auto mode: this uploads data to a remote server - allow it, or deny to stop.";
  }

  // Remote file copy out of the machine.
  if (REMOTE_COPY_TOOLS.has(cmd) && args.some(looksRemote)) {
    return "Auto mode: this copies files to a remote host - allow it, or deny to stop.";
  }

  // Any network/file-transfer tool touching a secret path.
  if (
    (DOWNLOADERS.has(cmd) || REMOTE_COPY_TOOLS.has(cmd) || RAW_NETWORK_TOOLS.has(cmd)) &&
    args.some(referencesSecret)
  ) {
    return "Auto mode: this sends a secret/credential file over the network — allow it, or deny.";
  }

  return undefined;
}

/** `curl https://… | sh` — a downloader anywhere upstream of an interpreter in the pipeline. */
function remotePipeToShell(
  segments: readonly { cmd: string; args: string[] }[],
): string | undefined {
  const sawDownloader = segments.some((s) => DOWNLOADERS.has(s.cmd));
  const sawInterpreter = segments.some((s) => SHELL_INTERPRETERS.has(s.cmd));
  if (sawDownloader && sawInterpreter) {
    return "Auto mode: this pipes downloaded content into a shell/interpreter (remote code execution) — allow it, or deny.";
  }
  return undefined;
}

function isForkBomb(command: string): boolean {
  // Classic bash fork bomb `:(){ :|:& };:` (allowing whitespace variations).
  return /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/.test(command);
}

/** A `-r`/`-R`/`--recursive` flag (including short clusters like `-rf`). */
function isRecursive(args: readonly string[]): boolean {
  return args.some(
    (a) =>
      a === "-R" || a === "--recursive" || (/^-[a-zA-Z]+$/.test(a) && a.slice(1).includes("r")),
  );
}

/** A `curl`/`wget` arg set that uploads (sends a body or a file out). */
function isUpload(args: readonly string[]): boolean {
  return args.some(
    (a) =>
      a === "-T" ||
      a === "--upload-file" ||
      a === "-d" ||
      a === "--data" ||
      a === "--data-binary" ||
      a === "--data-raw" ||
      a === "--data-urlencode" ||
      a === "-F" ||
      a === "--form" ||
      a.startsWith("--upload-file=") ||
      a.startsWith("--data=") ||
      // `-d @file` / `-F field=@file`, but not a URL with userinfo like `https://tok@host/x`.
      (a.includes("@") && !/^https?:\/\//i.test(a)),
  );
}

/** A `host:path` / `user@host:path` remote target (scp/sftp/rsync). Excludes `C:\…` drive paths. */
function looksRemote(arg: string): boolean {
  if (/^[A-Za-z]:[\\/]/.test(arg)) return false; // Windows drive path
  return /^[^/\\]*[\w.-]+:(?!\/\/)/.test(arg) || /@[\w.-]+:/.test(arg);
}

/** Broad/dangerous deletion or sweep targets (root, home, parent, globs, system dirs). */
function isBroadTarget(arg: string): boolean {
  if (arg === "/" || arg === "~" || arg === ".." || arg === "." || arg === "*") return true;
  if (arg.startsWith("~")) return true;
  if (/^\$\{?HOME\}?$/.test(arg)) return true; // $HOME or ${HOME}
  if (arg.includes("*")) return true;
  if (/^\/(etc|usr|bin|sbin|var|lib|opt|boot|dev|sys|root|home)(\/|$)/.test(arg)) return true;
  if (/^[A-Za-z]:[\\/]?$/.test(arg)) return true; // a bare drive root `C:\`
  return false;
}

function windowsDeleteReason(): string {
  return "Auto mode: this recursively deletes or formats files - allow it, or deny to stop.";
}

// ---------------------------------------------------------------------------------------------
// Edit / write rules
// ---------------------------------------------------------------------------------------------

function assessWriteRisk(input: unknown, projectPath: string): AutoRisk {
  const path = extractPath(input);
  if (!path) return SAFE;
  if (referencesSecret(path)) {
    return {
      risky: true,
      reason: "Auto mode: this writes to a secret/credential file - allow it, or deny to stop.",
    };
  }
  if (/(^|[\\/])\.git[\\/]/.test(path)) {
    return {
      risky: true,
      reason: "Auto mode: this writes inside the `.git` directory - allow it, or deny to stop.",
    };
  }
  if (isOutsideProject(path, projectPath)) {
    return {
      risky: true,
      reason: "Auto mode: this writes to a path outside the project - allow it, or deny to stop.",
    };
  }
  return SAFE;
}

/** Secret / credential file shapes, matched against a path or a shell argument. */
const SECRET_PATTERNS: readonly RegExp[] = [
  /(^|[\\/])\.env(\.[\w.-]+)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /\.keystore$/i,
  /(^|[\\/])id_rsa\b/i,
  /(^|[\\/])id_ed25519\b/i,
  /(^|[\\/])id_ecdsa\b/i,
  /(^|[\\/])id_dsa\b/i,
  /(^|[\\/])\.npmrc$/i,
  /(^|[\\/])\.netrc$/i,
  /(^|[\\/])\.pgpass$/i,
  /(^|[\\/])\.git-credentials$/i,
  /(^|[\\/])credentials$/i,
  /[\\/]\.ssh[\\/]/i,
  /[\\/]\.aws[\\/]/i,
  /[\\/]\.kube[\\/]config/i,
  /[\\/]\.docker[\\/]config\.json/i,
  /[\\/]\.config[\\/]gcloud[\\/]/i,
];

function referencesSecret(value: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(value));
}

/** Whether a resolved edit/write path falls outside the project root. */
function isOutsideProject(path: string, projectPath: string): boolean {
  const target = absolutize(path, projectPath);
  const root = normalize(projectPath);
  if (target === root) return false;
  const prefix = root.endsWith(sep) ? root : root + sep;
  return !target.startsWith(prefix);
}

function absolutize(path: string, base: string): string {
  return normalize(isAbsolute(path) ? path : resolve(base, path));
}

// ---------------------------------------------------------------------------------------------
// Input extraction
// ---------------------------------------------------------------------------------------------

function extractCommand(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const command = (input as { command?: unknown }).command;
  return typeof command === "string" && command.length > 0 ? command : undefined;
}

function extractPath(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const path = (input as { path?: unknown }).path;
  return typeof path === "string" && path.length > 0 ? path : undefined;
}
