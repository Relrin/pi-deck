import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Density = "compact" | "cozy";
export type FontPair = "default" | "sans-only" | "mono-only";

export type DiffIndicators = "bars" | "classic" | "none";

export interface PreferencesState {
  density: Density;
  fonts: FontPair;
  diffIndicators: DiffIndicators;
  /** Full-width add/del row background in the diff viewer. */
  diffBackground: boolean;
  /** Show the line-number gutter in the diff viewer. */
  diffLineNumbers: boolean;
  /** Wrap long code lines instead of horizontal scrolling. */
  diffLineWrap: boolean;
  /** Pierre theme when active app theme has `kind: "light"`. */
  diffThemeLight: string;
  /** Pierre theme when the app theme has `kind: "dark"`. */
  diffThemeDark: string;
  setDensity: (d: Density) => void;
  setFonts: (f: FontPair) => void;
  setDiffIndicators: (style: DiffIndicators) => void;
  setDiffBackground: (on: boolean) => void;
  setDiffLineNumbers: (on: boolean) => void;
  setDiffLineWrap: (on: boolean) => void;
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
      diffIndicators: "classic",
      diffBackground: true,
      diffLineNumbers: true,
      diffLineWrap: false,
      diffThemeLight: "github-light-default",
      diffThemeDark: "github-dark-default",
      setDensity: (density) => {
        applyDensity(density);
        set({ density });
      },
      setFonts: (fonts) => {
        applyFonts(fonts);
        set({ fonts });
      },
      setDiffIndicators: (diffIndicators) => set({ diffIndicators }),
      setDiffBackground: (diffBackground) => set({ diffBackground }),
      setDiffLineNumbers: (diffLineNumbers) => set({ diffLineNumbers }),
      setDiffLineWrap: (diffLineWrap) => set({ diffLineWrap }),
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
