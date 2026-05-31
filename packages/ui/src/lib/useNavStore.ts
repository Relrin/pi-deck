import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NavScreen = "blank" | "session" | "editor" | "git-diff" | "git-history";

/**
 * Which file the `git-diff` screen should render, plus the baseline to render against.
 * Ad-hoc clicks from the git sidebar default to `"HEAD"`; the review flow opens the
 * `ReviewPanel` modal instead and does not touch this field.
 */
export interface DiffTarget {
  projectId: string;
  path: string;
}

export interface NavStoreState {
  screen: NavScreen;
  diffTarget: DiffTarget | null;
  expandedProjectsOverview: Record<string, boolean>;
  expandedProjectsRail: Record<string, boolean>;
  setScreen: (screen: NavScreen) => void;
  setDiffTarget: (target: DiffTarget | null) => void;
  /** Convenience: switch to the diff screen and point it at `target` in one go. */
  openDiff: (target: DiffTarget) => void;
  toggleOverviewProject: (projectId: string) => void;
  toggleRailProject: (projectId: string) => void;
  goToSession: () => void;
  goToBlank: () => void;
}

const TRANSIENT_SCREENS: ReadonlySet<NavScreen> = new Set(["editor", "git-diff", "git-history"]);

export const useNavStore = create<NavStoreState>()(
  persist(
    (set) => ({
      screen: "blank",
      diffTarget: null,
      expandedProjectsOverview: {},
      expandedProjectsRail: {},
      setScreen: (screen) =>
        // Stepping away from the diff screen drops its target so a stale path can't be
        // re-opened by a later "switch back" interaction.
        set(screen === "git-diff" ? { screen } : { screen, diffTarget: null }),
      setDiffTarget: (diffTarget) => set({ diffTarget }),
      openDiff: (target) => set({ screen: "git-diff", diffTarget: target }),
      toggleOverviewProject: (projectId) =>
        set((state) => ({
          expandedProjectsOverview: {
            ...state.expandedProjectsOverview,
            [projectId]: !isExpanded(state.expandedProjectsOverview, projectId),
          },
        })),
      toggleRailProject: (projectId) =>
        set((state) => ({
          expandedProjectsRail: {
            ...state.expandedProjectsRail,
            [projectId]: !isExpanded(state.expandedProjectsRail, projectId),
          },
        })),
      goToSession: () => set({ screen: "session", diffTarget: null }),
      goToBlank: () => set({ screen: "blank", diffTarget: null }),
    }),
    {
      name: "pi-deck:nav:v1",
      partialize: (state) => ({
        screen: state.screen,
        expandedProjectsOverview: state.expandedProjectsOverview,
        expandedProjectsRail: state.expandedProjectsRail,
      }),
      onRehydrateStorage: () => (rehydrated) => {
        if (!rehydrated) return;
        // Migrate stored "overview" route from earlier builds to the renamed "blank" route.
        if ((rehydrated.screen as string) === "overview") {
          rehydrated.screen = "blank";
        }
        if (TRANSIENT_SCREENS.has(rehydrated.screen)) {
          rehydrated.screen = "session";
        }
      },
    },
  ),
);

function isExpanded(map: Record<string, boolean>, projectId: string): boolean {
  return map[projectId] ?? true;
}

/** Default-true selector for overview section expansion. */
export function useOverviewExpanded(projectId: string): boolean {
  return useNavStore((s) => isExpanded(s.expandedProjectsOverview, projectId));
}

/** Default-true selector for rail section expansion. */
export function useRailExpanded(projectId: string): boolean {
  return useNavStore((s) => isExpanded(s.expandedProjectsRail, projectId));
}
