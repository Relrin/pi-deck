import type { ContextUsage, TokenUsage } from "@pi-deck/core/protocol/events.js";
import { create } from "zustand";

/** Estimated context cost of this session's MCP tools, pushed by the worker after extensions bind. */
export interface McpUsage {
  tokens: number;
  toolCount: number;
}

interface SessionUsage {
  /** Token counts from the most recent turn. */
  lastTurn: TokenUsage;
  /** Aggregate context window state at the end of that turn. */
  context: ContextUsage | undefined;
  /** MCP tools' estimated slice of the context window, when the worker has reported it. */
  mcp: McpUsage | undefined;
}

interface UsageStoreState {
  bySession: Record<string, SessionUsage>;
  setTurnUsage: (sessionId: string, usage: TokenUsage, context: ContextUsage | undefined) => void;
  setMcpUsage: (sessionId: string, mcp: McpUsage) => void;
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
          // Preserve the MCP estimate across turns — it's pushed once on worker spawn, not per turn.
          mcp: state.bySession[sessionId]?.mcp,
          lastTurn: usage,
          context,
        },
      },
    })),

  setMcpUsage: (sessionId, mcp) =>
    set((state) => {
      const prev = state.bySession[sessionId];
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: {
            lastTurn: prev?.lastTurn ?? EMPTY_TURN,
            context: prev?.context,
            mcp,
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

export function selectSessionMcp(sessionId: string | undefined) {
  return (state: UsageStoreState): McpUsage | undefined =>
    sessionId ? state.bySession[sessionId]?.mcp : undefined;
}
