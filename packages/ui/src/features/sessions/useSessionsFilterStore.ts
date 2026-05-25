import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Session status used by the Status filter. Only `running` (= turn in flight) and `idle`
 * are derivable from current data; `review` / `merged` are accepted into the state for
 * forward-compatibility with the mockup but currently no-op when applied. See
 * `applySessionsFilter` in `useSessionsStore`.
 */
export type SessionStatus = "running" | "review" | "merged" | "idle";
export const ALL_STATUSES: readonly SessionStatus[] = ["running", "review", "merged", "idle"];

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
  /** Selected status filters. The mockup defaults to all four boxes checked. */
  status: SessionStatus[];
  /** Project filter. `{ kind: "all" }` = every project visible, the default. */
  project: ProjectSelection;
  /** Recency cutoff. */
  since: SessionsSince;
  /** Sort dimension. */
  sort: SessionsSort;
  /** Grouping dimension. */
  group: SessionsGroup;

  toggleStatus: (s: SessionStatus) => void;
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
  status: ALL_STATUSES.slice(),
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
  if (!sameStatusSet(state.status, DEFAULTS.status)) n++;
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
  section: "status" | "project" | "since" | "sort" | "group",
): boolean {
  switch (section) {
    case "status":
      return !sameStatusSet(state.status, DEFAULTS.status);
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

function sameStatusSet(a: SessionStatus[], b: readonly SessionStatus[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

export const useSessionsFilterStore = create<SessionsFilterState>()(
  persist(
    (set) => ({
      status: DEFAULTS.status,
      project: DEFAULTS.project,
      since: DEFAULTS.since,
      sort: DEFAULTS.sort,
      group: DEFAULTS.group,

      toggleStatus: (s) =>
        set((state) => {
          const has = state.status.includes(s);
          return { status: has ? state.status.filter((x) => x !== s) : [...state.status, s] };
        }),

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
          status: DEFAULTS.status,
          project: DEFAULTS.project,
          since: DEFAULTS.since,
          sort: DEFAULTS.sort,
          group: DEFAULTS.group,
        }),
    }),
    {
      name: "pi-deck:sessions-filter:v1",
      partialize: (state) => ({
        status: state.status,
        project: state.project,
        since: state.since,
        sort: state.sort,
        group: state.group,
      }),
    },
  ),
);
