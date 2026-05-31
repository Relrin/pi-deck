import type { ReviewTurn } from "@pi-deck/core/protocol/commands.js";
import { create } from "zustand";
import { useSessionsStore } from "../sessions/useSessionsStore.js";

interface SessionReviewState {
  /** Pending review turns for this session, newest last. Populated by `EVENT_REVIEW_AVAILABLE`
   * and the initial `review.list` fetch. Mutated when a turn / file is accepted or rejected. */
  turns: ReviewTurn[];
  /** Currently-open turn in the `ReviewPanel`. `null` when the panel is closed. */
  openTurnId: string | null;
  /** Currently-selected file path inside the open turn. `null` until a row is clicked
   * (the panel auto-picks the first file when a turn opens). */
  selectedPath: string | null;
}

export interface ReviewStoreState {
  bySession: Record<string, SessionReviewState>;
  /** Append (or replace) a review turn pushed by the host. Idempotent on `turnId`. */
  upsertTurn: (sessionId: string, turn: ReviewTurn) => void;
  /** Drop a single turn from a session — called from `EVENT_REVIEW_CLEARED`. */
  clearTurn: (sessionId: string, turnId: string) => void;
  /** Drop every pending turn for a session (worker exit / session delete). */
  clearSession: (sessionId: string) => void;
  /** Replace the cached turn list, used by the `review.list` priming fetch. */
  replaceList: (sessionId: string, turns: ReviewTurn[]) => void;

  /** Open the latest pending turn in the review modal. No-op when none exists. */
  openLatestTurn: (sessionId: string) => void;
  /** Close the review modal. */
  closePanel: (sessionId: string) => void;
  /** Select a file inside the open turn. */
  selectFile: (sessionId: string, path: string | null) => void;

  /** Fetch the pending turns for a session on mount — primes the store after a refresh. */
  primeFor: (sessionId: string) => Promise<void>;

  /** Issue the corresponding `review.*` RPC. Optimistic — UI rolls back on error. */
  acceptTurn: (sessionId: string, turnId: string) => Promise<void>;
  rejectTurn: (sessionId: string, turnId: string) => Promise<void>;
  acceptFile: (sessionId: string, turnId: string, path: string) => Promise<void>;
  rejectFile: (sessionId: string, turnId: string, path: string) => Promise<void>;
}

function emptySessionState(): SessionReviewState {
  return { turns: [], openTurnId: null, selectedPath: null };
}

export const useReviewStore = create<ReviewStoreState>((set, get) => ({
  bySession: {},

  upsertTurn: (sessionId, turn) =>
    set((state) => {
      const prev = state.bySession[sessionId] ?? emptySessionState();
      const existingIndex = prev.turns.findIndex((t) => t.turnId === turn.turnId);
      const turns =
        existingIndex >= 0
          ? prev.turns.map((t, i) => (i === existingIndex ? turn : t))
          : [...prev.turns, turn];
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: { ...prev, turns },
        },
      };
    }),

  clearTurn: (sessionId, turnId) =>
    set((state) => {
      const prev = state.bySession[sessionId];
      if (!prev) return state;
      const turns = prev.turns.filter((t) => t.turnId !== turnId);
      const openTurnId = prev.openTurnId === turnId ? null : prev.openTurnId;
      const selectedPath = prev.openTurnId === turnId ? null : prev.selectedPath;
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: { turns, openTurnId, selectedPath },
        },
      };
    }),

  clearSession: (sessionId) =>
    set((state) => {
      if (!(sessionId in state.bySession)) return state;
      const next = { ...state.bySession };
      delete next[sessionId];
      return { bySession: next };
    }),

  replaceList: (sessionId, turns) =>
    set((state) => {
      const prev = state.bySession[sessionId] ?? emptySessionState();
      const openTurnIsStale =
        prev.openTurnId !== null && !turns.some((t) => t.turnId === prev.openTurnId);
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: {
            turns,
            openTurnId: openTurnIsStale ? null : prev.openTurnId,
            selectedPath: openTurnIsStale ? null : prev.selectedPath,
          },
        },
      };
    }),

  openLatestTurn: (sessionId) =>
    set((state) => {
      const prev = state.bySession[sessionId];
      if (!prev) return state;
      const latest = prev.turns.at(-1);
      if (!latest) return state;
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: {
            ...prev,
            openTurnId: latest.turnId,
            selectedPath: prev.selectedPath ?? latest.files[0]?.path ?? null,
          },
        },
      };
    }),

  closePanel: (sessionId) =>
    set((state) => {
      const prev = state.bySession[sessionId];
      if (!prev) return state;
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: { ...prev, openTurnId: null, selectedPath: null },
        },
      };
    }),

  selectFile: (sessionId, selectedPath) =>
    set((state) => {
      const prev = state.bySession[sessionId];
      if (!prev) return state;
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: { ...prev, selectedPath },
        },
      };
    }),

  primeFor: async (sessionId) => {
    const client = useSessionsStore.getState().client;
    if (!client) return;
    try {
      const result = await client.call("review.list", { sessionId });
      get().replaceList(sessionId, result.turns);
    } catch {
      // Silent — review state is non-critical. The next event push will repopulate.
    }
  },

  acceptTurn: async (sessionId, turnId) => {
    const client = useSessionsStore.getState().client;
    if (!client) return;
    const prev = get().bySession[sessionId];
    get().clearTurn(sessionId, turnId);
    try {
      await client.call("review.accept", { sessionId, turnId });
    } catch (err) {
      // Restore state on failure so the user can retry.
      if (prev) set((state) => ({ bySession: { ...state.bySession, [sessionId]: prev } }));
      throw err;
    }
  },

  rejectTurn: async (sessionId, turnId) => {
    const client = useSessionsStore.getState().client;
    if (!client) return;
    const prev = get().bySession[sessionId];
    get().clearTurn(sessionId, turnId);
    try {
      await client.call("review.reject", { sessionId, turnId });
    } catch (err) {
      if (prev) set((state) => ({ bySession: { ...state.bySession, [sessionId]: prev } }));
      throw err;
    }
  },

  acceptFile: async (sessionId, turnId, path) => {
    const client = useSessionsStore.getState().client;
    if (!client) return;
    const prev = get().bySession[sessionId];
    // Optimistically drop the file from the local copy of the turn.
    optimisticallyRemoveFile(set, sessionId, turnId, path);
    try {
      await client.call("review.acceptFile", { sessionId, turnId, path });
    } catch (err) {
      if (prev) set((state) => ({ bySession: { ...state.bySession, [sessionId]: prev } }));
      throw err;
    }
  },

  rejectFile: async (sessionId, turnId, path) => {
    const client = useSessionsStore.getState().client;
    if (!client) return;
    const prev = get().bySession[sessionId];
    optimisticallyRemoveFile(set, sessionId, turnId, path);
    try {
      await client.call("review.rejectFile", { sessionId, turnId, path });
    } catch (err) {
      if (prev) set((state) => ({ bySession: { ...state.bySession, [sessionId]: prev } }));
      throw err;
    }
  },
}));

function optimisticallyRemoveFile(
  set: (updater: (state: ReviewStoreState) => Partial<ReviewStoreState> | ReviewStoreState) => void,
  sessionId: string,
  turnId: string,
  path: string,
): void {
  set((state) => {
    const prev = state.bySession[sessionId];
    if (!prev) return state;
    const turns = prev.turns
      .map((t) =>
        t.turnId === turnId ? { ...t, files: t.files.filter((f) => f.path !== path) } : t,
      )
      .filter((t) => t.files.length > 0);
    const stillOpen = turns.some((t) => t.turnId === prev.openTurnId);
    return {
      bySession: {
        ...state.bySession,
        [sessionId]: {
          turns,
          openTurnId: stillOpen ? prev.openTurnId : null,
          selectedPath:
            prev.selectedPath === path
              ? (turns.find((t) => t.turnId === prev.openTurnId)?.files[0]?.path ?? null)
              : prev.selectedPath,
        },
      },
    };
  });
}

/**
 * Convenience selector — total file count across every pending turn for a session.
 * Used by `ReviewBanner` to render "N files changed".
 */
export function selectPendingFileCount(sessionId: string) {
  return (state: ReviewStoreState): number => {
    const entry = state.bySession[sessionId];
    if (!entry) return 0;
    return entry.turns.reduce((sum, t) => sum + t.files.length, 0);
  };
}

export function selectOpenTurn(sessionId: string) {
  return (state: ReviewStoreState): ReviewTurn | null => {
    const entry = state.bySession[sessionId];
    if (!entry?.openTurnId) return null;
    return entry.turns.find((t) => t.turnId === entry.openTurnId) ?? null;
  };
}
