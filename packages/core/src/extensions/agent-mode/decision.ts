import { isAbsolute, normalize, resolve, sep } from "node:path";
import type { AgentMode } from "../../domain/session.js";

/** Built-in tools considered mutating by default. */
export const DEFAULT_MUTATING_TOOLS: ReadonlySet<string> = new Set(["bash", "edit", "write"]);
/** Built-in tools that always require explicit approval outside of plan mode. */
export const DEFAULT_SHELL_TOOLS: ReadonlySet<string> = new Set(["bash"]);

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
  mutatingTools?: ReadonlySet<string>;
  shellTools?: ReadonlySet<string>;
}

/**
 * Decide what to do with a tool call given the current agent mode. Pure — no IO, no timers,
 * no event emission. Caller turns `"approve"` into a Promise-backed user prompt.
 */
export function decideToolCall(opts: DecideOptions): AgentModeDecision {
  const mutating = opts.mutatingTools ?? DEFAULT_MUTATING_TOOLS;
  const shell = opts.shellTools ?? DEFAULT_SHELL_TOOLS;

  if (opts.mode === "plan" && mutating.has(opts.toolName)) {
    if (isPlanFileWrite(opts.toolName, opts.input, opts.planFilePath, opts.projectPath)) {
      return { kind: "allow" };
    }
    return {
      kind: "block",
      reason:
        "Plan mode is active. The user wants a plan only — no edits, writes, or shell commands. " +
        "Describe the changes you would make and stop; do not retry.",
    };
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
