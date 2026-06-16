import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RightPaneTab = "chat" | "git" | "context";

export interface RightPaneState {
  tab: RightPaneTab;
  composerFocusNonce: number;
  setTab: (tab: RightPaneTab) => void;
  focusGitComposer: () => void;
}

export const useRightPaneStore = create<RightPaneState>()(
  persist(
    (set) => ({
      tab: "git",
      composerFocusNonce: 0,
      setTab: (tab) => set({ tab }),
      focusGitComposer: () =>
        set((s) => ({ tab: "git", composerFocusNonce: s.composerFocusNonce + 1 })),
    }),
    {
      name: "pi-deck:rightpane:v1",
      // The focus nonce is a transient runtime signal — persisting it would re-trigger
      // a focus request on every reload. Only the tab choice is a real preference.
      partialize: (s) => ({ tab: s.tab }),
    },
  ),
);
