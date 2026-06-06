import { spawnSync } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";
import type { TerminalShell, TerminalShellKind } from "../protocol/commands.js";

/**
 * OS-aware shell detection for the integrated terminal. Adapted from coder/mux's
 * `resolveLocalPtyShell`: enumerate platform-appropriate candidates, keep only the ones that
 * actually exist as executables, and dedupe by resolved path. `detectShells` powers the
 * Terminal settings picker; `resolveShell` picks what to actually spawn (honouring a
 * user-configured override when it's valid).
 *
 * Kept as a mostly-pure helper with injectable deps so it can be unit-tested without touching
 * the real filesystem or `process`.
 */

export interface ShellDetectionDeps {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  /** True when a bare command resolves on PATH (via `where` / `which`). */
  isOnPath: (command: string) => boolean;
  /** True when a path-like value points at an executable file. */
  isExecutableFile: (candidate: string) => boolean;
  /** Installed WSL distro names (Windows only), e.g. `["Ubuntu", "Debian"]`. */
  listWslDistros: () => string[];
}

interface ShellCandidate {
  label: string;
  /** Absolute path or a bare command resolvable on PATH. */
  command: string;
  args: string[];
  kind: TerminalShellKind;
}

function isPathLike(command: string): boolean {
  return command.includes("/") || command.includes("\\");
}

/**
 * WSL surfaces POSIX paths / a bare `bash` that don't exist as real Windows executables — skip
 * them. Crucially this must NOT match a real path like `C:\Program Files\Git\bin\bash.exe`
 * (Git Bash), so only bare commands or the System32 WSL stub count.
 */
function looksLikeWslShell(shell: string): boolean {
  if (shell.startsWith("/")) return true;
  const normalized = shell.replace(/\//g, "\\").toLowerCase();
  if (normalized.endsWith("\\windows\\system32\\bash.exe")) return true;
  if (!normalized.includes("\\")) {
    return (
      normalized === "wsl" ||
      normalized === "wsl.exe" ||
      normalized === "bash" ||
      normalized === "bash.exe"
    );
  }
  return false;
}

function defaultIsOnPath(platform: NodeJS.Platform): (command: string) => boolean {
  return (command: string) => {
    if (!command) return false;
    try {
      const result = spawnSync(platform === "win32" ? "where" : "which", [command], {
        stdio: "ignore",
      });
      return result.status === 0;
    } catch {
      return false;
    }
  };
}

function defaultIsExecutableFile(candidate: string): boolean {
  try {
    if (!statSync(candidate).isFile()) return false;
    if (process.platform !== "win32") {
      accessSync(candidate, constants.X_OK);
      return true;
    }
    const ext = path.win32.extname(candidate).toLowerCase();
    if (!ext) return false;
    const pathExt = (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").toLowerCase();
    return pathExt
      .split(";")
      .map((e) => e.trim())
      .includes(ext);
  } catch {
    return false;
  }
}

function basenameLabel(command: string): string {
  const base = command.replace(/\\/g, "/").split("/").pop() ?? command;
  return base.replace(/\.(exe|cmd|bat|com)$/i, "");
}

/** Map a unix shell binary (by basename) to a coarse kind for icon selection. */
function unixKind(command: string): TerminalShellKind {
  const base = basenameLabel(command).toLowerCase();
  if (base === "zsh") return "zsh";
  if (base === "bash") return "bash";
  if (base === "fish") return "fish";
  if (base === "sh") return "sh";
  return "other";
}

function windowsCandidates(env: NodeJS.ProcessEnv): ShellCandidate[] {
  const candidates: ShellCandidate[] = [];
  const systemRoot = env.SystemRoot || "C:\\Windows";
  candidates.push({ label: "PowerShell", command: "pwsh.exe", args: [], kind: "powershell" });
  candidates.push({
    label: "Windows PowerShell",
    command: path.win32.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    args: [],
    kind: "powershell",
  });
  // Git Bash — try the usual install roots; launch as an interactive login shell.
  const programRoots = [env.ProgramW6432, env.ProgramFiles, env["ProgramFiles(x86)"]].filter(
    (p): p is string => Boolean(p),
  );
  for (const root of programRoots) {
    candidates.push({
      label: "Git Bash",
      command: path.win32.join(root, "Git", "bin", "bash.exe"),
      args: ["-i", "-l"],
      kind: "gitbash",
    });
  }
  candidates.push({
    label: "Command Prompt",
    command: env.ComSpec || "cmd.exe",
    args: [],
    kind: "cmd",
  });
  return candidates;
}

function unixCandidates(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): ShellCandidate[] {
  const candidates: ShellCandidate[] = [];
  const envShell = env.SHELL?.trim();
  if (envShell)
    candidates.push({
      label: basenameLabel(envShell),
      command: envShell,
      args: [],
      kind: unixKind(envShell),
    });
  const ordered =
    platform === "darwin"
      ? ["/bin/zsh", "/bin/bash", "/bin/sh"]
      : ["/bin/bash", "/usr/bin/zsh", "/bin/zsh", "/bin/sh"];
  for (const sh of ordered)
    candidates.push({ label: basenameLabel(sh), command: sh, args: [], kind: unixKind(sh) });
  return candidates;
}

/**
 * One candidate per installed WSL distro, spawned as `wsl.exe -d <distro>`. These deliberately
 * share the `wsl.exe` path and are told apart by their `args` — so detection dedupes on
 * command+args, and callers must carry the args (not just the path) to launch a specific distro.
 * Docker's internal distros are hidden, matching Windows Terminal.
 */
function wslCandidates(deps: ShellDetectionDeps): ShellCandidate[] {
  // Gate on wsl.exe existing before invoking the (process-spawning) lister, so non-Windows or
  // WSL-less machines — and unit tests — never shell out.
  if (!deps.isOnPath("wsl.exe")) return [];
  return deps
    .listWslDistros()
    .filter((name) => name && !/^docker-desktop/i.test(name))
    .map((name) => ({
      label: `${name} (WSL)`,
      command: "wsl.exe",
      args: ["-d", name],
      kind: "wsl" as const,
    }));
}

/**
 * Enumerate installed WSL distros via `wsl.exe -l -q`. wsl emits UTF-16LE with NUL padding and
 * CRLF line endings, so decode explicitly rather than trusting the default utf8 stringify.
 */
function defaultListWslDistros(): string[] {
  try {
    const res = spawnSync("wsl.exe", ["-l", "-q"], { windowsHide: true, timeout: 3000 });
    if (res.status !== 0 || !res.stdout) return [];
    return Buffer.from(res.stdout)
      .toString("utf16le")
      .split(/\r?\n/)
      .map((line) => line.replace(/\uFEFF/g, "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function resolveDeps(partial: Partial<ShellDetectionDeps>): ShellDetectionDeps {
  const platform = partial.platform ?? process.platform;
  return {
    platform,
    env: partial.env ?? process.env,
    isOnPath: partial.isOnPath ?? defaultIsOnPath(platform),
    isExecutableFile: partial.isExecutableFile ?? defaultIsExecutableFile,
    listWslDistros: partial.listWslDistros ?? defaultListWslDistros,
  };
}

function isAvailable(candidate: ShellCandidate, deps: ShellDetectionDeps): boolean {
  // WSL entries are already validated (they only exist because `wsl.exe -l -q` listed them) and
  // deliberately reuse the bare `wsl.exe` command that `looksLikeWslShell` rejects — so skip the
  // generic availability check for them.
  if (candidate.kind === "wsl") return true;
  const command = candidate.command;
  if (!command) return false;
  if (deps.platform === "win32" && looksLikeWslShell(command)) return false;
  return isPathLike(command) ? deps.isExecutableFile(command) : deps.isOnPath(command);
}

/** Module-level cache for the zero-dependency (production) detection, keyed off nothing because
 * the set of installed shells is stable for an app run. Spawning `where`/`which`/`wsl` on every
 * `terminal.open` would otherwise add latency to each new terminal. */
let cachedDefaultShells: TerminalShell[] | null = null;

/** Detected shells, in preference order, deduped by command+args. First entry is the default. */
export function detectShells(partial: Partial<ShellDetectionDeps> = {}): TerminalShell[] {
  const useCache = Object.keys(partial).length === 0;
  if (useCache && cachedDefaultShells) return cachedDefaultShells;

  const deps = resolveDeps(partial);
  const raw =
    deps.platform === "win32"
      ? [...windowsCandidates(deps.env), ...wslCandidates(deps)]
      : unixCandidates(deps.platform, deps.env);
  const shells: TerminalShell[] = [];
  const seen = new Set<string>();
  for (const candidate of raw) {
    if (!isAvailable(candidate, deps)) continue;
    // WSL distros share the `wsl.exe` command, so the dedupe key must include args.
    const key = `${candidate.command.toLowerCase()} ${candidate.args.join(" ")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    shells.push({
      label: candidate.label,
      path: candidate.command,
      args: candidate.args,
      kind: candidate.kind,
    });
  }

  if (useCache) cachedDefaultShells = shells;
  return shells;
}

/**
 * Pick the shell to spawn. A valid `configured` override wins; otherwise the first detected
 * shell; otherwise a platform-native last resort so we never strand the terminal.
 */
export function resolveShell(
  configured: string | undefined,
  partial: Partial<ShellDetectionDeps> = {},
): { command: string; args: string[] } {
  const deps = resolveDeps(partial);
  const detected = detectShells(partial);

  const override = configured?.trim();
  if (override) {
    const known = detected.find((s) => s.path.toLowerCase() === override.toLowerCase());
    if (known) return { command: known.path, args: known.args };
    if (isAvailable({ label: override, command: override, args: [], kind: "other" }, deps))
      return { command: override, args: [] };
  }

  const first = detected[0];
  if (first) return { command: first.path, args: first.args };

  if (deps.platform === "win32") return { command: deps.env.ComSpec || "cmd.exe", args: [] };
  if (deps.platform === "darwin") return { command: "/bin/zsh", args: [] };
  return { command: "/bin/bash", args: [] };
}
