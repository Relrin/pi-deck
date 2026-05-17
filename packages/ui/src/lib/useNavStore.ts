import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NavScreen = "blank" | "session" | "editor" | "git-diff" | "git-history";

export interface NavStoreState {
  screen: NavScreen;
  expandedProjectsOverview: Record<string, boolean>;
  expandedProjectsRail: Record<string, boolean>;
  setScreen: (screen: NavScreen) => void;
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
      expandedProjectsOverview: {},
      expandedProjectsRail: {},
      setScreen: (screen) => set({ screen }),
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
      goToSession: () => set({ screen: "session" }),
      goToBlank: () => set({ screen: "blank" }),
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
