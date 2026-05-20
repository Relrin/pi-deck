export type ToolCallStatus = "pending" | "running" | "done" | "error" | "cancelled";

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
