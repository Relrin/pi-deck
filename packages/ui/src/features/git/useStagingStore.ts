import { create } from "zustand";

/**
 * Per-project staging intent — which files the user has explicitly checked in the changes
 * list. This is *not* the same as git's index: it's an in-memory mirror that the commit
 * action then uses to `git add` the right paths before committing.
 *
 * Default state per project is the empty set, meaning "nothing selected" — the user has
 * to explicitly tick the files they want to commit (or click "stage all"). This matches
 * how most diff tools surface uncommitted changes and avoids surprise commits.
 */
interface StagingStoreState {
  /** Explicit user selection per project. Absent entry or empty set = nothing selected. */
  selectedByProject: Record<string, Set<string>>;
  toggle: (projectId: string, path: string) => void;
  selectAll: (projectId: string, allPaths: readonly string[]) => void;
  resetProject: (projectId: string) => void;
}

export const useStagingStore = create<StagingStoreState>((set) => ({
  selectedByProject: {},
  toggle: (projectId, path) => {
    set((state) => {
      const stored = state.selectedByProject[projectId];
      const base = new Set(stored ?? []);
      if (base.has(path)) base.delete(path);
      else base.add(path);
      return {
        selectedByProject: { ...state.selectedByProject, [projectId]: base },
      };
    });
  },
  selectAll: (projectId, allPaths) => {
    set((state) => ({
      selectedByProject: { ...state.selectedByProject, [projectId]: new Set(allPaths) },
    }));
  },
  resetProject: (projectId) =>
    set((state) => {
      const { [projectId]: _drop, ...remaining } = state.selectedByProject;
      return { selectedByProject: remaining };
    }),
}));
