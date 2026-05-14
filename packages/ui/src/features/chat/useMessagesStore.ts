import { create } from "zustand";
import type {
  AssistantMessageEntry,
  MessageEntry,
  ToolCallEntry,
  ToolCallStatus,
} from "./types.js";

interface SessionMessageState {
  messages: MessageEntry[];
  toolCalls: Record<string, ToolCallEntry>;
  isTurnInFlight: boolean;
}

interface MessagesStoreState {
  bySession: Record<string, SessionMessageState>;
  appendUserMessage: (
    sessionId: string,
    p: { messageId: string; text: string; createdAt: number },
  ) => void;
  appendAssistantDelta: (sessionId: string, deltaEvent: unknown, snapshot: unknown) => void;
  applyToolCallStart: (
    sessionId: string,
    p: { callId: string; name: string; input: unknown },
  ) => void;
  applyToolCallUpdate: (sessionId: string, p: { callId: string; partialResult: unknown }) => void;
  applyToolCallEnd: (
    sessionId: string,
    p: { callId: string; result: unknown; isError: boolean },
  ) => void;
  endTurn: (sessionId: string, cancelled: boolean | undefined) => void;
  markTurnInFlight: (sessionId: string, value: boolean) => void;
  clearSession: (sessionId: string) => void;
}

const emptySession = (): SessionMessageState => ({
  messages: [],
  toolCalls: {},
  isTurnInFlight: false,
});

function getOrInit(
  state: Record<string, SessionMessageState>,
  sessionId: string,
): SessionMessageState {
  const existing = state[sessionId];
  if (existing) return existing;
  return emptySession();
}

function extractDeltaText(deltaEvent: unknown): string {
  if (typeof deltaEvent !== "object" || deltaEvent === null) return "";
  const e = deltaEvent as { type?: string; delta?: unknown };
  if (e.type === "text_delta" && typeof e.delta === "string") return e.delta;
  return "";
}

function extractAssistantSnapshotText(snapshot: unknown): string {
  if (typeof snapshot !== "object" || snapshot === null) return "";
  const s = snapshot as { content?: unknown };
  if (!Array.isArray(s.content)) return "";
  return s.content
    .filter(
      (b): b is { type: string; text: string } =>
        typeof b === "object" &&
        b !== null &&
        (b as { type?: unknown }).type === "text" &&
        typeof (b as { text?: unknown }).text === "string",
    )
    .map((b) => b.text)
    .join("");
}

function lastAssistant(messages: MessageEntry[]): AssistantMessageEntry | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.kind === "assistant" && !m.isComplete) return m;
  }
  return undefined;
}

function newAssistant(now: number): AssistantMessageEntry {
  return {
    kind: "assistant",
    id: `a-${now}-${Math.random().toString(36).slice(2, 8)}`,
    text: "",
    isComplete: false,
    toolCallIds: [],
    createdAt: now,
  };
}

export const useMessagesStore = create<MessagesStoreState>((set) => ({
  bySession: {},

  appendUserMessage: (sessionId, { messageId, text, createdAt }) =>
    set((state) => {
      const session = getOrInit(state.bySession, sessionId);
      // Dedup by id (replay), and by same-text within a short window — the renderer appends
      // optimistically on `session.prompt` ack, and the bridge later emits its own
      // `user.message` event from pi's message_start. We don't want both to render.
      const DEDUP_WINDOW_MS = 10_000;
      if (
        session.messages.some(
          (m) =>
            m.kind === "user" &&
            (m.id === messageId ||
              (m.text === text && Math.abs(m.createdAt - createdAt) < DEDUP_WINDOW_MS)),
        )
      ) {
        return state;
      }
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: {
            ...session,
            messages: [...session.messages, { kind: "user", id: messageId, text, createdAt }],
            isTurnInFlight: true,
          },
        },
      };
    }),

  appendAssistantDelta: (sessionId, deltaEvent, snapshot) =>
    set((state) => {
      const session = getOrInit(state.bySession, sessionId);
      const messages = [...session.messages];
      let current = lastAssistant(messages);
      if (!current) {
        current = newAssistant(Date.now());
        messages.push(current);
      }
      const delta = extractDeltaText(deltaEvent);
      const updated: AssistantMessageEntry =
        delta.length > 0
          ? { ...current, text: current.text + delta }
          : { ...current, text: extractAssistantSnapshotText(snapshot) || current.text };
      messages[messages.length - 1] = updated;
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: { ...session, messages, isTurnInFlight: true },
        },
      };
    }),

  applyToolCallStart: (sessionId, { callId, name, input }) =>
    set((state) => {
      const session = getOrInit(state.bySession, sessionId);
      const messages = [...session.messages];
      let current = lastAssistant(messages);
      if (!current) {
        current = newAssistant(Date.now());
        messages.push(current);
      }
      if (!current.toolCallIds.includes(callId)) {
        const updated: AssistantMessageEntry = {
          ...current,
          toolCallIds: [...current.toolCallIds, callId],
        };
        messages[messages.length - 1] = updated;
      }
      const entry: ToolCallEntry = {
        id: callId,
        name,
        input,
        status: "running",
        startedAt: Date.now(),
      };
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: {
            ...session,
            messages,
            toolCalls: { ...session.toolCalls, [callId]: entry },
            isTurnInFlight: true,
          },
        },
      };
    }),

  applyToolCallUpdate: (sessionId, { callId, partialResult }) =>
    set((state) => {
      const session = state.bySession[sessionId];
      if (!session) return state;
      const existing = session.toolCalls[callId];
      if (!existing) return state;
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: {
            ...session,
            toolCalls: { ...session.toolCalls, [callId]: { ...existing, partialResult } },
          },
        },
      };
    }),

  applyToolCallEnd: (sessionId, { callId, result, isError }) =>
    set((state) => {
      const session = state.bySession[sessionId];
      if (!session) return state;
      const existing = session.toolCalls[callId];
      if (!existing) return state;
      const status: ToolCallStatus = isError ? "error" : "done";
      const errorText = isError ? extractErrorText(result) : undefined;
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: {
            ...session,
            toolCalls: {
              ...session.toolCalls,
              [callId]: { ...existing, result, status, errorText, endedAt: Date.now() },
            },
          },
        },
      };
    }),

  endTurn: (sessionId, cancelled) =>
    set((state) => {
      const session = state.bySession[sessionId];
      if (!session) return state;
      const messages = session.messages.map((m) =>
        m.kind === "assistant" && !m.isComplete ? { ...m, isComplete: true } : m,
      );
      let toolCalls = session.toolCalls;
      if (cancelled) {
        const next: Record<string, ToolCallEntry> = {};
        for (const [id, call] of Object.entries(session.toolCalls)) {
          next[id] =
            call.status === "running" || call.status === "pending"
              ? { ...call, status: "cancelled", endedAt: Date.now() }
              : call;
        }
        toolCalls = next;
      }
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: { ...session, messages, toolCalls, isTurnInFlight: false },
        },
      };
    }),

  markTurnInFlight: (sessionId, value) =>
    set((state) => {
      const session = getOrInit(state.bySession, sessionId);
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: { ...session, isTurnInFlight: value },
        },
      };
    }),

  clearSession: (sessionId) =>
    set((state) => {
      if (!state.bySession[sessionId]) return state;
      const next = { ...state.bySession };
      delete next[sessionId];
      return { bySession: next };
    }),
}));

function extractErrorText(result: unknown): string | undefined {
  if (typeof result === "string") return result;
  if (typeof result !== "object" || result === null) return undefined;
  const r = result as { content?: unknown; message?: unknown };
  if (typeof r.message === "string") return r.message;
  if (Array.isArray(r.content)) {
    const first = r.content.find(
      (b): b is { type: string; text: string } =>
        typeof b === "object" &&
        b !== null &&
        (b as { type?: unknown }).type === "text" &&
        typeof (b as { text?: unknown }).text === "string",
    );
    if (first) return first.text;
  }
  return undefined;
}

// Stable reference so selectors stay referentially equal across renders when there's no
// session state yet. Without this React's useSyncExternalStore sees a fresh [] every call
// and triggers an infinite re-render loop.
const EMPTY_MESSAGES: readonly MessageEntry[] = Object.freeze([]);

export function selectMessages(sessionId: string | undefined) {
  return (state: MessagesStoreState): readonly MessageEntry[] =>
    sessionId ? (state.bySession[sessionId]?.messages ?? EMPTY_MESSAGES) : EMPTY_MESSAGES;
}

export function selectToolCall(sessionId: string | undefined, callId: string) {
  return (state: MessagesStoreState): ToolCallEntry | undefined =>
    sessionId ? state.bySession[sessionId]?.toolCalls[callId] : undefined;
}

export function selectTurnInFlight(sessionId: string | undefined) {
  return (state: MessagesStoreState): boolean =>
    sessionId ? (state.bySession[sessionId]?.isTurnInFlight ?? false) : false;
}
