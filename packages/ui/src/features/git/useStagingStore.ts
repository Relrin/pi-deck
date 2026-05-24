import { create } from "zustand";

/**
 * Per-project staging intent — which files the user has checked in the changes list. This
 * is *not* the same as git's index: it's an in-memory mirror that the commit action then
 * uses to `git add` the right paths before committing.
 *
 * Stored as a record-of-sets so we can scope state per project (switching projects keeps
 * each one's selection independent) and reset cleanly on demand.
 *
 * "Empty set" is overloaded with a "select-all by default" meaning — see `getSelected`.
 * That lets a fresh project start with every changed file pre-checked without us having
 * to chase the change list on every status refresh.
 */
interface StagingStoreState {
  /** Explicit user selection. Empty set = "use default (all changed paths)". */
  selectedByProject: Record<string, Set<string>>;
  toggle: (projectId: string, path: string, allPaths: readonly string[]) => void;
  selectAll: (projectId: string, allPaths: readonly string[]) => void;
  /** Materialize the effective selection: caller-provided allPaths intersected with the
   * stored set, or all of them when the stored set is the empty "default" sentinel. */
  getSelected: (projectId: string, allPaths: readonly string[]) => Set<string>;
  resetProject: (projectId: string) => void;
}

export const useStagingStore = create<StagingStoreState>((set, get) => ({
  selectedByProject: {},
  toggle: (projectId, path, allPaths) => {
    set((state) => {
      const stored = state.selectedByProject[projectId];
      // First click out of the "everything's selected by default" state needs to
      // materialize the full set before removing one — otherwise unchecking a single file
      // would collapse the selection to "only that file checked", which is the opposite of
      // what the user just did.
      const base = !stored || stored.size === 0 ? new Set(allPaths) : new Set(stored);
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
  getSelected: (projectId, allPaths) => {
    const stored = get().selectedByProject[projectId];
    const result = new Set<string>();
    for (const p of allPaths) {
      if (!stored || stored.size === 0 || stored.has(p)) result.add(p);
    }
    return result;
  },
  resetProject: (projectId) =>
    set((state) => {
      const { [projectId]: _drop, ...remaining } = state.selectedByProject;
      return { selectedByProject: remaining };
    }),
}));
