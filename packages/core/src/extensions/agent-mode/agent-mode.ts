import { randomUUID } from "node:crypto";
import type {
  ExtensionAPI,
  ExtensionFactory,
  ToolCallEvent,
  ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import type { AgentMode } from "../../domain/session.js";
import { decideToolCall } from "./decision.js";

export const APPROVAL_TIMEOUT_MS = 5 * 60_000;

/** Inputs the plugin needs about a pending tool call when asking for user approval. */
export interface ToolApprovalRequest {
  approvalId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
  /** Optional plugin-provided context, e.g. "Edit target outside the auto-approve allowlist." */
  reason?: string;
}

export type ApprovalDecision = "allow" | "deny";

export interface AgentModeExtensionOptions {
  projectPath: string;
  initialMode?: AgentMode;
  /**
   * Initial absolute paths that auto-approve in `accept-edits` mode. Defaults to `[projectPath]`
   * — every edit inside the project is fine; anything outside still prompts. Pass `[]` to start
   * with no allowlist (every edit prompts).
   */
  initialAllowlist?: string[];
  /** Override mutating-tool set. */
  mutatingTools?: ReadonlySet<string>;
  /** Override shell-tool set. */
  shellTools?: ReadonlySet<string>;
  /**
   * Approval handle pipeline. The plugin calls `onRequest` synchronously when a tool call needs
   * user input; the host bridges this to the renderer (e.g. via a WebSocket event). The host
   * later calls `resolveApproval()` on the returned controller.
   */
  onApprovalRequest: (request: ToolApprovalRequest) => void;
  approvalTimeoutMs?: number;
  /** Injectable timers for deterministic tests. */
  timers?: {
    setTimeout: (cb: () => void, ms: number) => unknown;
    clearTimeout: (handle: unknown) => void;
  };
}

export interface AgentModeController {
  readonly factory: ExtensionFactory;
  /** Switch the active mode. */
  setMode(mode: AgentMode): void;
  getMode(): AgentMode;
  /** Replace the entire edit-allowlist. Paths are stored verbatim and normalized at compare time. */
  setEditAllowlist(paths: readonly string[]): void;
  getEditAllowlist(): readonly string[];
  /**
   * Resolve a pending approval. Unknown ids are a no-op so duplicate replies (e.g. from a
   * stale renderer) don't throw.
   */
  resolveApproval(approvalId: string, decision: ApprovalDecision, reason?: string): void;
  /** Snapshot of currently pending approval ids. */
  pendingApprovalIds(): string[];
  /** Cancel every pending approval as a block; used when the worker shuts down mid-turn. */
  dispose(): void;
}

interface PendingEntry {
  resolve: (result: ToolCallEventResult) => void;
  timerHandle: unknown;
}

/**
 * Built-in pi-deck plugin that enforces the composer's agent mode:
 *
 * - `plan`   — every mutating tool call (bash/edit/write) is blocked with a stable reason.
 * - `ask`    — every mutating tool call routes through `onApprovalRequest`. Read-only tools
 *              (read/grep/find/ls and any other non-mutating tool) flow through untouched.
 * - `accept-edits` — `edit` calls inside `editAllowlist` auto-approve; everything else
 *              (bash, edits outside the allowlist) goes through `onApprovalRequest`.
 *
 * The plugin owns no IO and no network; it just maps `(mode, toolName, input)` to a decision
 * and exposes a controller the host pokes at over its IPC channel.
 */
export function createAgentModeExtension(options: AgentModeExtensionOptions): AgentModeController {
  const timers = options.timers ?? {
    setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms),
    clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof globalThis.setTimeout>),
  };
  const timeoutMs = options.approvalTimeoutMs ?? APPROVAL_TIMEOUT_MS;

  let mode: AgentMode = options.initialMode ?? "plan";
  let allowlist: string[] =
    options.initialAllowlist !== undefined ? [...options.initialAllowlist] : [options.projectPath];
  const pending = new Map<string, PendingEntry>();

  function requestApproval(event: ToolCallEvent, reason?: string): Promise<ToolCallEventResult> {
    return new Promise((resolve) => {
      const approvalId = randomUUID();
      const timerHandle = timers.setTimeout(() => {
        const entry = pending.get(approvalId);
        if (!entry) return;
        pending.delete(approvalId);
        entry.resolve({
          block: true,
          reason: `Approval timed out after ${Math.round(timeoutMs / 1000)}s without a response.`,
        });
      }, timeoutMs);
      pending.set(approvalId, { resolve, timerHandle });
      options.onApprovalRequest({
        approvalId,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        input: event.input,
        reason,
      });
    });
  }

  const factory: ExtensionFactory = (pi: ExtensionAPI) => {
    pi.on("tool_call", async (event: ToolCallEvent): Promise<ToolCallEventResult | undefined> => {
      const decision = decideToolCall({
        mode,
        toolName: event.toolName,
        input: event.input,
        editAllowlist: allowlist,
        projectPath: options.projectPath,
        mutatingTools: options.mutatingTools,
        shellTools: options.shellTools,
      });
      if (decision.kind === "allow") return undefined;
      if (decision.kind === "block") {
        return { block: true, reason: decision.reason };
      }
      return await requestApproval(event, decision.reason);
    });
  };

  return {
    factory,
    setMode(next) {
      mode = next;
    },
    getMode() {
      return mode;
    },
    setEditAllowlist(paths) {
      allowlist = [...paths];
    },
    getEditAllowlist() {
      return allowlist;
    },
    resolveApproval(approvalId, decision, reason) {
      const entry = pending.get(approvalId);
      if (!entry) return;
      pending.delete(approvalId);
      timers.clearTimeout(entry.timerHandle);
      entry.resolve(
        decision === "deny" ? { block: true, reason: reason ?? "Denied by user." } : {},
      );
    },
    pendingApprovalIds() {
      return [...pending.keys()];
    },
    dispose() {
      for (const [id, entry] of pending) {
        timers.clearTimeout(entry.timerHandle);
        entry.resolve({ block: true, reason: "Session closed before approval was answered." });
        pending.delete(id);
      }
    },
  };
}
