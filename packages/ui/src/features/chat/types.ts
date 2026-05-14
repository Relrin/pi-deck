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
  text: string;
  isComplete: boolean;
  toolCallIds: string[];
  createdAt: number;
}

export type MessageEntry = UserMessageEntry | AssistantMessageEntry;
