import { create } from "zustand";

/**
 * One newly-created file the agent wrote during the session. Mirrors the host-side
 * `ArtefactEntry` shape; we keep it as a plain interface here so the Context tab doesn't have
 * to import core types just to render rows.
 */
export interface ArtefactRecord {
  /** OS-native absolute path captured at creation time. */
  path: string;
  sizeBytes: number;
  /** Host-wall-clock ms when the file first appeared. */
  createdAt: number;
}

interface ArtefactsStoreState {
  bySession: Record<string, ArtefactRecord[]>;
  setForSession: (sessionId: string, artefacts: ArtefactRecord[]) => void;
  clearSession: (sessionId: string) => void;
}

/**
 * Renderer-side mirror of the host's `ArtefactsTracker`. Fed by `session.artefacts.changed`
 * events (live) and `session.artefacts.list` round-trips (initial prime when the Context tab
 * mounts). Cleared explicitly on session.delete so reopening a session id doesn't carry stale
 * artefacts from a prior run.
 */
export const useArtefactsStore = create<ArtefactsStoreState>((set) => ({
  bySession: {},

  setForSession: (sessionId, artefacts) =>
    set((state) => ({
      bySession: { ...state.bySession, [sessionId]: artefacts },
    })),

  clearSession: (sessionId) =>
    set((state) => {
      if (!state.bySession[sessionId]) return state;
      const next = { ...state.bySession };
      delete next[sessionId];
      return { bySession: next };
    }),
}));

const EMPTY_ARTEFACTS: readonly ArtefactRecord[] = Object.freeze([]);

export function selectArtefacts(sessionId: string | undefined) {
  return (state: ArtefactsStoreState): readonly ArtefactRecord[] =>
    sessionId ? (state.bySession[sessionId] ?? EMPTY_ARTEFACTS) : EMPTY_ARTEFACTS;
}
