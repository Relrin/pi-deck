import { isAbsolute, normalize, resolve, sep } from "node:path";
import type { AgentMode, PlanGatePolicy } from "../../domain/session.js";
import { isReadOnlyBashCommand } from "./bash-safety.js";

/** Built-in tools considered mutating by default. */
export const DEFAULT_MUTATING_TOOLS: ReadonlySet<string> = new Set(["bash", "edit", "write"]);
/** Built-in tools that always require explicit approval outside of plan mode. */
export const DEFAULT_SHELL_TOOLS: ReadonlySet<string> = new Set(["bash"]);
/**
 * Tools that only inspect — they flow through untouched in every mode, and are auto-allowed in
 * plan mode. Anything NOT here (and not a read-only shell command) is treated as side-effecting
 * in plan mode and gated per `planGatePolicy`. `bash` is deliberately absent: it's classified
 * per-command via `isReadOnlyBashCommand`.
 */
export const DEFAULT_READ_ONLY_TOOLS: ReadonlySet<string> = new Set([
  "read",
  "grep",
  "find",
  "ls",
  "glob",
  "tree",
]);

/** Plan mode defaults to prompting (rather than blocking) for non-read-only operations. */
export const DEFAULT_PLAN_GATE_POLICY: PlanGatePolicy = "approve";

export type AgentModeDecision =
  | { kind: "allow" }
  | { kind: "block"; reason: string }
  | { kind: "approve"; reason?: string };

export interface DecideOptions {
  mode: AgentMode;
  toolName: string;
  input: unknown;
  /** Absolutized allowlist of edit roots; matched against `EditToolInput.path`. */
  editAllowlist: readonly string[];
  /** Project root, used to resolve relative edit-tool paths to absolute form. */
  projectPath: string;
  /** Absolute path of the per-session plan file. */
  planFilePath?: string;
  /** What plan mode does with non-read-only operations. Defaults to `approve`. */
  planGatePolicy?: PlanGatePolicy;
  mutatingTools?: ReadonlySet<string>;
  shellTools?: ReadonlySet<string>;
  readOnlyTools?: ReadonlySet<string>;
}

/**
 * Decide what to do with a tool call given the current agent mode. Pure — no IO, no timers,
 * no event emission. Caller turns `"approve"` into a Promise-backed user prompt.
 */
export function decideToolCall(opts: DecideOptions): AgentModeDecision {
  const mutating = opts.mutatingTools ?? DEFAULT_MUTATING_TOOLS;
  const shell = opts.shellTools ?? DEFAULT_SHELL_TOOLS;

  if (opts.mode === "plan") {
    return decidePlanMode(opts, shell);
  }

  if (opts.mode === "accept-edits" && opts.toolName === "edit") {
    const path = extractEditPath(opts.input);
    if (path && isEditPathAllowed(opts.editAllowlist, path, opts.projectPath)) {
      return { kind: "allow" };
    }
    return { kind: "approve", reason: "Edit target outside the auto-approve allowlist." };
  }

  if (opts.mode === "ask" || (opts.mode === "accept-edits" && shell.has(opts.toolName))) {
    if (mutating.has(opts.toolName) || shell.has(opts.toolName)) {
      return { kind: "approve" };
    }
    return { kind: "allow" };
  }

  return { kind: "allow" };
}

/**
 * Plan-mode policy. Read-only operations (read/grep/ls/... and read-only shell commands) plus the
 * one writable plan file always flow through. Everything else — edits, writes, mutating shell,
 * MCP / network / other side-effecting tools — is gated: `approve` prompts the user, `block`
 * refuses outright.
 */
function decidePlanMode(opts: DecideOptions, shell: ReadonlySet<string>): AgentModeDecision {
  if (isPlanFileWrite(opts.toolName, opts.input, opts.planFilePath, opts.projectPath)) {
    return { kind: "allow" };
  }
  if (isPlanReadOnly(opts, shell)) {
    return { kind: "allow" };
  }

  const policy = opts.planGatePolicy ?? DEFAULT_PLAN_GATE_POLICY;
  const isShell = shell.has(opts.toolName);
  if (policy === "approve") {
    return {
      kind: "approve",
      reason: isShell
        ? "Plan mode: this shell command isn't read-only — allow it to run, or deny to keep planning."
        : "Plan mode: this operation can change files or reach outside the workspace — allow it, or deny to keep planning.",
    };
  }
  return {
    kind: "block",
    reason: isShell
      ? "Plan mode is active. Read-only shell commands (ls, cat, grep, find, etc.) are allowed, " +
        "but this command looks like it could modify the workspace, so it's blocked. Use a " +
        "read-only command to inspect things, or describe the change you would make and stop; " +
        "do not retry."
      : "Plan mode is active. The user wants a plan only — no edits, writes, or other " +
        "workspace-changing operations. Describe the changes you would make and stop; do not retry.",
  };
}

/** Whether a tool call is a pure read-only inspection (auto-allowed in plan mode). */
function isPlanReadOnly(opts: DecideOptions, shell: ReadonlySet<string>): boolean {
  if (shell.has(opts.toolName)) return isReadOnlyBashCommand(opts.input);
  const readOnly = opts.readOnlyTools ?? DEFAULT_READ_ONLY_TOOLS;
  return readOnly.has(opts.toolName);
}

/**
 * Returns true when `editPath` falls inside any root in `allowlist`. Both sides are normalized
 * to absolute form and compared with a trailing-separator check so `/repo/srcfoo` does not match
 * an allowlist entry of `/repo/src`.
 */
export function isEditPathAllowed(
  allowlist: readonly string[],
  editPath: string,
  projectPath: string,
): boolean {
  if (allowlist.length === 0) return false;
  const target = absolutize(editPath, projectPath);
  for (const root of allowlist) {
    const abs = absolutize(root, projectPath);
    if (target === abs) return true;
    const prefix = abs.endsWith(sep) ? abs : abs + sep;
    if (target.startsWith(prefix)) return true;
  }
  return false;
}

function absolutize(path: string, base: string): string {
  return normalize(isAbsolute(path) ? path : resolve(base, path));
}

function extractEditPath(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const candidate = (input as { path?: unknown }).path;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined;
}

/**
 * The agent is allowed to write/edit ONE specific file — the per-session
 * plan file — so it can persist the plan it just produced. Match is exact (after resolving
 * both sides to absolute form via the same helper used by `isEditPathAllowed`); sibling paths
 * or backups like `<plan>.bak` are NOT covered.
 */
export function isPlanFileWrite(
  toolName: string,
  input: unknown,
  planFilePath: string | undefined,
  projectPath: string,
): boolean {
  if (!planFilePath) return false;
  if (toolName !== "edit" && toolName !== "write") return false;
  const target = extractEditPath(input);
  if (!target) return false;
  return absolutize(target, projectPath) === absolutize(planFilePath, projectPath);
}
