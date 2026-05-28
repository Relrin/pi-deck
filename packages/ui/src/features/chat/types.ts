import type { AgentMode } from "@pi-deck/core/domain/session.js";
import type { PromptAttachment } from "@pi-deck/core/protocol/commands.js";

export type ToolCallStatus = "pending" | "running" | "done" | "error" | "cancelled";

/**
 * Inline approval surfaced on a tool-call card when the agent-mode plugin needs the user's
 * decision before letting the tool run. Set when `session.tool.approval.requested` arrives
 * for this call; cleared when the matching `session.tool.call.end` fires (or when the user
 * clicks Allow/Deny on the inline pill).
 */
export interface PendingToolApproval {
  approvalId: string;
  /** Optional hint from the plugin (e.g. "Edit target outside the auto-approve allowlist."). */
  reason?: string;
}

/**
 * Per-image record attached to a user message in history. We keep only the small
 * thumbnail data-URL — the full base64 payload is sent to pi once and discarded from
 * the renderer to avoid bloating the messages store. On session reload from pi the
 * thumbnail is lost (by design), matching standard chat-app behavior.
 */
export interface UserMessageImage {
  /** ~256 px max-dim data-URL used for the chip + lightbox. */
  thumbnailDataUrl: string;
  name: string;
  mimeType: string;
}

export interface ToolCallEntry {
  id: string;
  name: string;
  input: unknown;
  partialResult?: unknown;
  result?: unknown;
  status: ToolCallStatus;
  errorText?: string;
  startedAt: number;
  endedAt?: number;
  pendingApproval?: PendingToolApproval;
}

export interface UserMessageEntry {
  kind: "user";
  id: string;
  text: string;
  createdAt: number;
  /** Files / folders / refs the user attached when sending this prompt. */
  attachments?: PromptAttachment[];
  /** Inline image attachments (e.g. clipboard pastes), kept as thumbnails only. */
  images?: UserMessageImage[];
}

export interface AssistantMessageEntry {
  kind: "assistant";
  id: string;
  /** Pi's stable timestamp for this assistant message — used to dedup retries. */
  remoteTimestamp?: number;
  text: string;
  isComplete: boolean;
  toolCallIds: string[];
  createdAt: number;
  /**
   * The model that produced this response, as reported by pi on the assistant snapshot.
   * Captured per-message so the UI can show which model answered each turn — useful when
   * users switch models mid-session.
   */
  model?: string;
  /**
   * Agent mode the session was in when this assistant turn began. Stamped once on bubble
   * creation so the UI can branch — most importantly, plan-shaped detection: an assistant
   * message rendered as a `PlanCard` requires `agentModeAtTurn === "plan"` plus a GFM
   * checkbox in the body. Persisted in `loadHistory` would be ideal but pi's saved
   * sessionFile doesn't carry the mode per turn; on resume `agentModeAtTurn` is left
   * undefined and detection falls through to the default Markdown renderer.
   */
  agentModeAtTurn?: AgentMode;
}

export type MessageEntry = UserMessageEntry | AssistantMessageEntry;
