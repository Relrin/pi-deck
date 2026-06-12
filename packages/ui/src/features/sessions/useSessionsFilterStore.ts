import { create } from "zustand";
import { persist } from "zustand/middleware";

/** "Since" buckets the user can pick to hide stale sessions. `all` disables the cutoff. */
export type SessionsSince = "1d" | "7d" | "14d" | "30d" | "all";
export const ALL_SINCE: readonly SessionsSince[] = ["1d", "7d", "14d", "30d", "all"];

/** Sort dimension applied to each visible group. */
export type SessionsSort = "recent" | "created" | "branch" | "status";
export const ALL_SORT: readonly SessionsSort[] = ["recent", "created", "branch", "status"];

/**
 * Grouping dimension. `workspace` (group by project) and `flat` (single ungrouped list)
 * are wired; `branch` and `status` accept the selection for forward-compat but currently
 * fall back to workspace grouping in the rail.
 */
export type SessionsGroup = "workspace" | "branch" | "status" | "flat";
export const ALL_GROUP: readonly SessionsGroup[] = ["workspace", "branch", "status", "flat"];

/** Sentinel for the Project filter when no per-project selection has been made — every
 * project is considered checked. The renderer never persists the project list itself
 * (projects are discovered at runtime), so we represent "all selected" as `null` instead
 * of materialising a Set we'd have to keep in sync. A non-null Set means the user opted
 * into a custom subset. */
export type ProjectSelection = { kind: "all" } | { kind: "subset"; ids: string[] };

export interface SessionsFilterState {
  /** Project filter. `{ kind: "all" }` = every project visible, the default. */
  project: ProjectSelection;
  /** Recency cutoff. */
  since: SessionsSince;
  /** Sort dimension. */
  sort: SessionsSort;
  /** Grouping dimension. */
  group: SessionsGroup;

  setProject: (selection: ProjectSelection) => void;
  toggleProject: (projectId: string, allKnownIds: readonly string[]) => void;
  setProjectAll: (allKnownIds: readonly string[]) => void;
  setProjectNone: () => void;
  setSince: (since: SessionsSince) => void;
  setSort: (sort: SessionsSort) => void;
  setGroup: (group: SessionsGroup) => void;
  reset: () => void;
}

export const DEFAULTS = {
  project: { kind: "all" } as ProjectSelection,
  since: "7d" as SessionsSince,
  sort: "recent" as SessionsSort,
  group: "workspace" as SessionsGroup,
};

/**
 * Returns the number of filter slots that diverge from defaults. The mockup uses this
 * count to badge the trigger button ("• 1") and to switch the footer label between
 * "defaults" and "N active".
 */
export function dirtyCount(state: SessionsFilterState): number {
  let n = 0;
  if (state.project.kind !== "all") n++;
  if (state.since !== DEFAULTS.since) n++;
  if (state.sort !== DEFAULTS.sort) n++;
  if (state.group !== DEFAULTS.group) n++;
  return n;
}

/**
 * Per-section dirty check. Drives the small accent dot rendered on each accordion header
 * when that section diverges from its default.
 */
export function isSectionDirty(
  state: SessionsFilterState,
  section: "project" | "since" | "sort" | "group",
): boolean {
  switch (section) {
    case "project":
      return state.project.kind !== "all";
    case "since":
      return state.since !== DEFAULTS.since;
    case "sort":
      return state.sort !== DEFAULTS.sort;
    case "group":
      return state.group !== DEFAULTS.group;
  }
}

export const useSessionsFilterStore = create<SessionsFilterState>()(
  persist(
    (set) => ({
      project: DEFAULTS.project,
      since: DEFAULTS.since,
      sort: DEFAULTS.sort,
      group: DEFAULTS.group,

      setProject: (selection) => set({ project: selection }),

      toggleProject: (projectId, allKnownIds) =>
        set((state) => {
          // First click off "all" materialises the full list, then drops the toggled id.
          const current = state.project.kind === "all" ? [...allKnownIds] : [...state.project.ids];
          const has = current.includes(projectId);
          const next = has ? current.filter((id) => id !== projectId) : [...current, projectId];
          // If the user re-checks every known project, collapse back to the "all" sentinel
          // so isSectionDirty returns false and the footer says "defaults".
          if (next.length === allKnownIds.length && allKnownIds.every((id) => next.includes(id))) {
            return { project: { kind: "all" } };
          }
          return { project: { kind: "subset", ids: next } };
        }),

      setProjectAll: (allKnownIds) => {
        // We could just store the "all" sentinel, but callers passing through this helper
        // expect the canonical sentinel form.
        void allKnownIds;
        set({ project: { kind: "all" } });
      },

      setProjectNone: () => set({ project: { kind: "subset", ids: [] } }),

      setSince: (since) => set({ since }),
      setSort: (sort) => set({ sort }),
      setGroup: (group) => set({ group }),

      reset: () =>
        set({
          project: DEFAULTS.project,
          since: DEFAULTS.since,
          sort: DEFAULTS.sort,
          group: DEFAULTS.group,
        }),
    }),
    {
      name: "pi-deck:sessions-filter:v1",
      // A stale `status` key from older builds is dropped here simply by not being listed.
      partialize: (state) => ({
        project: state.project,
        since: state.since,
        sort: state.sort,
        group: state.group,
      }),
    },
  ),
);
