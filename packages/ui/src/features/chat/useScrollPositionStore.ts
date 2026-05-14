import { create } from "zustand";

export interface ScrollSnapshot {
  /** Scroll offset (px) of the messages container at last snapshot. */
  offset: number;
  /** Whether the user was within the sticky-bottom threshold. Restored state respects this. */
  atBottom: boolean;
}

interface ScrollPositionStoreState {
  bySession: Record<string, ScrollSnapshot>;
  snapshot: (sessionId: string, snap: ScrollSnapshot) => void;
  get: (sessionId: string) => ScrollSnapshot | undefined;
  clear: (sessionId: string) => void;
}

/**
 * Per-session scroll memory. `MessageList` snapshots on unmount (session switch) and reads
 * back on mount, so each conversation keeps its own scroll offset. `atBottom: true` always
 * wins on restore so a session that was at the latest message lands at the latest message
 * even if its content grew while the user was away.
 */
export const useScrollPositionStore = create<ScrollPositionStoreState>((set, getState) => ({
  bySession: {},
  snapshot: (sessionId, snap) =>
    set((state) => ({ bySession: { ...state.bySession, [sessionId]: snap } })),
  get: (sessionId) => getState().bySession[sessionId],
  clear: (sessionId) =>
    set((state) => {
      if (!state.bySession[sessionId]) return state;
      const next = { ...state.bySession };
      delete next[sessionId];
      return { bySession: next };
    }),
}));
