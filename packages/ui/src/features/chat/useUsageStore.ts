import type { ContextUsage, TokenUsage } from "@pi-deck/core/protocol/events.js";
import { create } from "zustand";

/**
 * This session's fixed context overhead, pushed by the worker once its extensions bind. Estimated
 * from the real system prompt + registered tool definitions (chars/4), so the breakdown can
 * attribute each slice instead of guessing with constants.
 */
export interface ContextCost {
  systemPrompt: number;
  builtinTools: number;
  mcp: number;
  mcpToolCount: number;
}

interface SessionUsage {
  /** Token counts from the most recent turn. */
  lastTurn: TokenUsage;
  /** Aggregate context window state at the end of that turn. */
  context: ContextUsage | undefined;
  /** Per-category context overhead (system prompt + tool defs), when the worker has reported it. */
  cost: ContextCost | undefined;
}

interface UsageStoreState {
  bySession: Record<string, SessionUsage>;
  setTurnUsage: (sessionId: string, usage: TokenUsage, context: ContextUsage | undefined) => void;
  setContextCost: (sessionId: string, cost: ContextCost) => void;
  clearSession: (sessionId: string) => void;
}

const EMPTY_TURN: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };

export const useUsageStore = create<UsageStoreState>((set) => ({
  bySession: {},

  setTurnUsage: (sessionId, usage, context) =>
    set((state) => ({
      bySession: {
        ...state.bySession,
        [sessionId]: {
          // Preserve the cost estimate across turns — it's pushed once on worker spawn, not per turn.
          cost: state.bySession[sessionId]?.cost,
          lastTurn: usage,
          context,
        },
      },
    })),

  setContextCost: (sessionId, cost) =>
    set((state) => {
      const prev = state.bySession[sessionId];
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: {
            lastTurn: prev?.lastTurn ?? EMPTY_TURN,
            context: prev?.context,
            cost,
          },
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

export function selectSessionUsage(sessionId: string | undefined) {
  return (state: UsageStoreState): SessionUsage | undefined =>
    sessionId ? state.bySession[sessionId] : undefined;
}

export function selectSessionCost(sessionId: string | undefined) {
  return (state: UsageStoreState): ContextCost | undefined =>
    sessionId ? state.bySession[sessionId]?.cost : undefined;
}
