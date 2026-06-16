import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Density = "compact" | "cozy";
export type FontPair = "default" | "sans-only" | "mono-only";
/**
 * App layout shape. `agent` is the linear session → editor → diff flow (default);
 * `ide` docks the chat as a right-pane tab beside the editor. NB: unrelated to pi's
 * execution `agentMode` (ask/accept-edits/plan).
 */
export type ViewMode = "agent" | "ide";
/**
 * How much horizontal space the integrated terminal dock takes when open. `center` (default)
 * keeps it within the center column; the others let it span over the left rail and/or right
 * pane, with the covered panel shrinking vertically to make room.
 */
export type TerminalWidth = "center" | "center-left" | "center-right" | "all";
export type DiffIndicators = "bars" | "classic" | "none";
export type DiffLayout = "split" | "unified";
export type DiffLineDiffType = "word-alt" | "word" | "char" | "none";

export interface PreferencesState {
  density: Density;
  fonts: FontPair;
  /** Layout shape: `agent` (linear) or `ide` (chat docked beside the editor). */
  viewMode: ViewMode;
  /** How wide the integrated terminal dock is when open. */
  terminalWidth: TerminalWidth;
  diffIndicators: DiffIndicators;
  /** Full-width add/del row background in the diff viewer. */
  diffBackground: boolean;
  /** Show the line-number gutter in the diff viewer. */
  diffLineNumbers: boolean;
  /** Wrap long code lines instead of horizontal scrolling. */
  diffLineWrap: boolean;
  /** Split vs unified arrangement of old / new content. Drives the toolbar's layout button. */
  diffLayout: DiffLayout;
  /** Inline-change highlight algorithm. */
  diffLineDiffType: DiffLineDiffType;
  /** Pierre theme when active app theme has `kind: "light"`. */
  diffThemeLight: string;
  /** Pierre theme when the app theme has `kind: "dark"`. */
  diffThemeDark: string;
  setDensity: (d: Density) => void;
  setFonts: (f: FontPair) => void;
  setViewMode: (v: ViewMode) => void;
  setTerminalWidth: (w: TerminalWidth) => void;
  setDiffIndicators: (style: DiffIndicators) => void;
  setDiffBackground: (on: boolean) => void;
  setDiffLineNumbers: (on: boolean) => void;
  setDiffLineWrap: (on: boolean) => void;
  setDiffLayout: (layout: DiffLayout) => void;
  setDiffLineDiffType: (type: DiffLineDiffType) => void;
  setDiffThemeLight: (name: string) => void;
  setDiffThemeDark: (name: string) => void;
}

function applyDensity(d: Density): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (d === "cozy") root.setAttribute("data-density", "cozy");
  else root.removeAttribute("data-density");
}

function applyFonts(f: FontPair): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (f === "default") root.removeAttribute("data-fonts");
  else root.setAttribute("data-fonts", f);
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      density: "compact",
      fonts: "default",
      viewMode: "agent",
      terminalWidth: "center",
      diffIndicators: "classic",
      diffBackground: true,
      diffLineNumbers: true,
      diffLineWrap: false,
      // Side-by-side reads better for code review and is what every reviewer-facing tool
      // (GitHub, Reviewable, Phabricator) defaults to. Users who prefer the compact stacked
      // view can flip via the per-diff toolbar or Settings → Git & GitHub.
      diffLayout: "split",
      // No inline highlight by default — line-level add/del marks alone are the least noisy
      // read and match what `git diff` shows in the terminal. Users who want char- or word-
      // grained highlights opt in via the toolbar / Settings.
      diffLineDiffType: "none",
      diffThemeLight: "pierre-light-soft",
      diffThemeDark: "pierre-dark-soft",
      setDensity: (density) => {
        applyDensity(density);
        set({ density });
      },
      setFonts: (fonts) => {
        applyFonts(fonts);
        set({ fonts });
      },
      setViewMode: (viewMode) => set({ viewMode }),
      setTerminalWidth: (terminalWidth) => set({ terminalWidth }),
      setDiffIndicators: (diffIndicators) => set({ diffIndicators }),
      setDiffBackground: (diffBackground) => set({ diffBackground }),
      setDiffLineNumbers: (diffLineNumbers) => set({ diffLineNumbers }),
      setDiffLineWrap: (diffLineWrap) => set({ diffLineWrap }),
      setDiffLayout: (diffLayout) => set({ diffLayout }),
      setDiffLineDiffType: (diffLineDiffType) => set({ diffLineDiffType }),
      setDiffThemeLight: (diffThemeLight) => set({ diffThemeLight }),
      setDiffThemeDark: (diffThemeDark) => set({ diffThemeDark }),
    }),
    {
      name: "pi-deck:prefs",
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        applyDensity(state.density);
        applyFonts(state.fonts);
      },
    },
  ),
);
