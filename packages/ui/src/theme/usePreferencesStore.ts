import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Density = "compact" | "cozy";
export type FontPair = "default" | "sans-only" | "mono-only";

export interface PreferencesState {
  density: Density;
  fonts: FontPair;
  setDensity: (d: Density) => void;
  setFonts: (f: FontPair) => void;
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
      setDensity: (density) => {
        applyDensity(density);
        set({ density });
      },
      setFonts: (fonts) => {
        applyFonts(fonts);
        set({ fonts });
      },
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
