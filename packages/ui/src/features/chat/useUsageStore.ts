import type { ContextUsage, TokenUsage } from "@pi-deck/core/protocol/events.js";
import { create } from "zustand";

interface SessionUsage {
  /** Token counts from the most recent turn. */
  lastTurn: TokenUsage;
  /** Aggregate context window state at the end of that turn. */
  context: ContextUsage | undefined;
}

interface UsageStoreState {
  bySession: Record<string, SessionUsage>;
  setTurnUsage: (sessionId: string, usage: TokenUsage, context: ContextUsage | undefined) => void;
  clearSession: (sessionId: string) => void;
}

export const useUsageStore = create<UsageStoreState>((set) => ({
  bySession: {},

  setTurnUsage: (sessionId, usage, context) =>
    set((state) => ({
      bySession: {
        ...state.bySession,
        [sessionId]: { lastTurn: usage, context },
      },
    })),

  clearSession: (sessionId) =>
    set((state) => {
      if (!state.bySession[sessionId]) return state;
      const next = { ...state.bySession };
      delete next[sessionId];
      return { bySession: next };
    }),
}));

export function selectSessionUsage(sessionId: string | undefined) {
  return (state: UsageStoreState): SessionUsage | undefined =>
    sessionId ? state.bySession[sessionId] : undefined;
}
