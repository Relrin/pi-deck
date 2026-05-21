import type { PromptAttachment } from "@pi-deck/core/protocol/commands.js";

export type ToolCallStatus = "pending" | "running" | "done" | "error" | "cancelled";

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
}

export type MessageEntry = UserMessageEntry | AssistantMessageEntry;
