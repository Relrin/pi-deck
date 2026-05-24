import type { PromptAttachment } from "@pi-deck/core/protocol/commands.js";
import { create } from "zustand";
import { USER_MESSAGE_DEDUP_WINDOW_MS } from "../../lib/ui-constants.js";
import type {
  AssistantMessageEntry,
  MessageEntry,
  ToolCallEntry,
  ToolCallStatus,
  UserMessageImage,
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
    p: {
      messageId: string;
      text: string;
      createdAt: number;
      attachments?: PromptAttachment[];
      images?: UserMessageImage[];
    },
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
  /**
   * Replace the chat transcript + tool-call cache for a session with the snapshot the
   * host emits after activating a resumed session. Idempotent — repeated emissions on
   * the same session simply re-seed with the same data.
   */
  loadHistory: (
    sessionId: string,
    payload: { messages: MessageEntry[]; toolCalls: Record<string, ToolCallEntry> },
  ) => void;
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

function extractAssistantTimestamp(snapshot: unknown): number | undefined {
  if (typeof snapshot !== "object" || snapshot === null) return undefined;
  const s = snapshot as { timestamp?: unknown };
  return typeof s.timestamp === "number" ? s.timestamp : undefined;
}

/**
 * Pi attaches the resolved model id to the AssistantMessage snapshot. We persist it on the
 * message entry so the UI can show the model that produced each turn — important when users
 * switch models mid-session.
 */
function extractAssistantModel(snapshot: unknown): string | undefined {
  if (typeof snapshot !== "object" || snapshot === null) return undefined;
  const s = snapshot as { model?: unknown };
  return typeof s.model === "string" && s.model.length > 0 ? s.model : undefined;
}

function lastIncompleteAssistantIdx(messages: MessageEntry[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.kind === "assistant" && !m.isComplete) return i;
  }
  return -1;
}

// Late deltas (replay, network re-order) can arrive after `endTurn` has flipped every
// in-flight assistant to complete. The "last incomplete" fallback misses, so we first try
// to match by pi's stable `remoteTimestamp` — that ties a delta to its existing bubble
// even after it's been marked complete.
function findAssistantByTimestamp(messages: MessageEntry[], ts: number | undefined): number {
  if (ts === undefined) return -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.kind === "assistant" && m.remoteTimestamp === ts) return i;
  }
  return -1;
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

/**
 * Pi only carries the resolved `model` on the assistant snapshot delivered via
 * `message.delta` / `appendAssistantDelta`. When a new agent turn opens with a tool call
 * BEFORE any text delta arrives (a common pi pattern between turns within one agent loop),
 * `applyToolCallStart` is the first event we see and it creates a bubble that has no model
 * attached — the UI then falls back to the "pi" label even though the user knows which
 * model is running. Carrying the last known model forward keeps these continuation bubbles
 * labelled correctly; the next `message.delta` (which does include `model`) will overwrite
 * it if pi reports a different one mid-stream.
 */
function lastKnownAssistantModel(messages: MessageEntry[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.kind === "assistant" && m.model) return m.model;
  }
  return undefined;
}

export const useMessagesStore = create<MessagesStoreState>((set) => ({
  bySession: {},

  appendUserMessage: (sessionId, { messageId, text, createdAt, attachments, images }) =>
    set((state) => {
      const session = getOrInit(state.bySession, sessionId);
      // Dedup by id (replay), and by same-text within a short window — the renderer appends
      // optimistically on `session.prompt` ack, and the bridge later emits its own
      // `user.message` event from pi's message_start. We don't want both to render.
      if (
        session.messages.some(
          (m) =>
            m.kind === "user" &&
            (m.id === messageId ||
              (m.text === text &&
                Math.abs(m.createdAt - createdAt) < USER_MESSAGE_DEDUP_WINDOW_MS)),
        )
      ) {
        return state;
      }
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: {
            ...session,
            messages: [
              ...session.messages,
              {
                kind: "user",
                id: messageId,
                text,
                createdAt,
                ...(attachments && attachments.length > 0 ? { attachments } : {}),
                ...(images && images.length > 0 ? { images } : {}),
              },
            ],
            // Leave isTurnInFlight as-is: by the time the bridge echo arrives the turn may
            // already be complete, and we don't want to flip "Stop" back on.
          },
        },
      };
    }),

  appendAssistantDelta: (sessionId, _deltaEvent, snapshot) =>
    set((state) => {
      const session = getOrInit(state.bySession, sessionId);
      const messages = [...session.messages];
      const remoteTimestamp = extractAssistantTimestamp(snapshot);
      const snapshotText = extractAssistantSnapshotText(snapshot);
      const snapshotModel = extractAssistantModel(snapshot);

      // First: try to match by stable timestamp — survives `endTurn`, so a late delta
      // arriving after the turn ended still updates its existing bubble instead of
      // pushing a duplicate.
      const tsIdx = findAssistantByTimestamp(messages, remoteTimestamp);
      if (tsIdx >= 0) {
        const matched = messages[tsIdx] as AssistantMessageEntry;
        messages[tsIdx] = {
          ...matched,
          text: snapshotText || matched.text,
          model: snapshotModel ?? matched.model,
        };
        return {
          bySession: {
            ...state.bySession,
            [sessionId]: { ...session, messages, isTurnInFlight: session.isTurnInFlight },
          },
        };
      }

      // Find the in-progress assistant. If one exists with a *different* remote timestamp,
      // pi has rolled to a new attempt (auto-retry) — drop the stale one so we don't end up
      // with two bubbles for the same logical response.
      const idx = lastIncompleteAssistantIdx(messages);
      const current = idx >= 0 ? (messages[idx] as AssistantMessageEntry) : undefined;
      const isRetry =
        current?.remoteTimestamp !== undefined &&
        remoteTimestamp !== undefined &&
        current.remoteTimestamp !== remoteTimestamp;
      if (current && isRetry) {
        // Replace the stale bubble with the fresh stream.
        messages[idx] = {
          ...current,
          remoteTimestamp,
          text: snapshotText,
          model: snapshotModel ?? current.model,
        };
      } else if (current) {
        messages[idx] = {
          ...current,
          // Lock in the first timestamp we see so a later delta with the same id still matches.
          remoteTimestamp: current.remoteTimestamp ?? remoteTimestamp,
          // Snapshot-as-truth: avoids accumulating duplicate deltas if pi/provider replays them.
          text: snapshotText || current.text,
          model: snapshotModel ?? current.model,
        };
      } else {
        const fresh = newAssistant(Date.now());
        fresh.remoteTimestamp = remoteTimestamp;
        fresh.text = snapshotText;
        // Prefer the model from the snapshot; otherwise carry the last known model forward
        // so a turn that begins with a text delta (rare, but possible) still labels correctly.
        fresh.model = snapshotModel ?? lastKnownAssistantModel(messages);
        messages.push(fresh);
      }
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

      // Pi sometimes re-emits `tool_execution_start` for a callId that we already attached
      // to an earlier assistant bubble (e.g. when a new turn begins, the previous turn's
      // tool history can be replayed). If we let the default path run again, the callId
      // would be appended to a *second* bubble's `toolCallIds`, and the renderer would
      // render the same ToolCallCard twice. Drop the event when the call is already known
      // and attached — keep the existing entry's state (status, partialResult, result)
      // exactly as is.
      const alreadyAttached = session.messages.some(
        (m) => m.kind === "assistant" && m.toolCallIds.includes(callId),
      );
      if (alreadyAttached) {
        return state;
      }

      const messages = [...session.messages];
      let idx = lastIncompleteAssistantIdx(messages);
      let current: AssistantMessageEntry;
      if (idx === -1) {
        // No in-flight assistant — pi opened the new turn with a tool call, before any
        // text delta arrived. Carry the previous turn's model so this continuation row
        // doesn't fall back to the generic "pi" label. `appendAssistantDelta` will
        // overwrite `model` from the snapshot once pi emits the first text delta.
        current = newAssistant(Date.now());
        current.model = lastKnownAssistantModel(messages);
        messages.push(current);
        idx = messages.length - 1;
      } else {
        current = messages[idx] as AssistantMessageEntry;
      }
      const updated: AssistantMessageEntry = {
        ...current,
        toolCallIds: [...current.toolCallIds, callId],
      };
      messages[idx] = updated;
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

  loadHistory: (sessionId, payload) =>
    set((state) => ({
      bySession: {
        ...state.bySession,
        [sessionId]: {
          messages: payload.messages,
          toolCalls: payload.toolCalls,
          // History never describes an in-flight turn — by definition it's settled work.
          isTurnInFlight: false,
        },
      },
    })),
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
