import { create } from "zustand";

/**
 * Per-session toolbar state for the diff viewer. Intentionally not persisted — these
 * toggles feel per-context (the user might want split layout on one diff and unified
 * on another) and survive only as long as the renderer process.
 *
 * The persisted, globally-scoped diff preferences (line-number gutter, line wrap,
 * row backgrounds, indicator style) live in `usePreferencesStore` and are read
 * directly inside `DiffView`.
 */
export type DiffLayout = "split" | "unified";

export interface DiffSettingsState {
  layout: DiffLayout;
  wordHighlight: boolean;
  setLayout: (layout: DiffLayout) => void;
  setWordHighlight: (wordHighlight: boolean) => void;
}

export const useDiffSettingsStore = create<DiffSettingsState>((set) => ({
  layout: "split",
  wordHighlight: true,
  setLayout: (layout) => set({ layout }),
  setWordHighlight: (wordHighlight) => set({ wordHighlight }),
}));
