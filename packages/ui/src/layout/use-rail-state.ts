import { create } from "zustand";
import { persist } from "zustand/middleware";

const MIN_LEFT_WIDTH = 200;
// The right pane hosts the git commit composer; its two buttons ("commit" + "commit & push")
// are right-aligned and live on a single row. Below ~280px the second button starts to wrap
// or get clipped, which looks broken. Lock the right pane min to that floor so the composer
// always renders cleanly, independent of what the left rail's min is.
const MIN_RIGHT_WIDTH = 280;
const MAX_WIDTH = 520;
const DEFAULT_LEFT_WIDTH = 264;
const DEFAULT_RIGHT_WIDTH = 360;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export interface RailState {
  leftWidth: number;
  rightWidth: number;
  leftVisible: boolean;
  rightVisible: boolean;
  setLeftWidth: (px: number) => void;
  setRightWidth: (px: number) => void;
  setLeftVisible: (v: boolean) => void;
  setRightVisible: (v: boolean) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
}

export const useRailState = create<RailState>()(
  persist(
    (set) => ({
      leftWidth: DEFAULT_LEFT_WIDTH,
      rightWidth: DEFAULT_RIGHT_WIDTH,
      leftVisible: true,
      rightVisible: true,
      setLeftWidth: (px) => set({ leftWidth: clamp(px, MIN_LEFT_WIDTH, MAX_WIDTH) }),
      setRightWidth: (px) => set({ rightWidth: clamp(px, MIN_RIGHT_WIDTH, MAX_WIDTH) }),
      setLeftVisible: (v) => set({ leftVisible: v }),
      setRightVisible: (v) => set({ rightVisible: v }),
      toggleLeft: () => set((s) => ({ leftVisible: !s.leftVisible })),
      toggleRight: () => set((s) => ({ rightVisible: !s.rightVisible })),
    }),
    {
      name: "pi-deck:rails",
      version: 3,
      // v1 → v2 added leftVisible/rightVisible. Default both to true so existing
      // users see no change on upgrade.
      // v2 → v3 raised the right-pane min from 200 → 280 to fit the git commit composer.
      // Bump any persisted rightWidth that's below the new floor.
      migrate: (persisted, version) => {
        const next = (persisted ?? {}) as Partial<RailState>;
        if (version < 2) {
          next.leftVisible = true;
          next.rightVisible = true;
        }
        if (version < 3) {
          if (typeof next.rightWidth === "number" && next.rightWidth < MIN_RIGHT_WIDTH) {
            next.rightWidth = MIN_RIGHT_WIDTH;
          }
        }
        return next as RailState;
      },
    },
  ),
);

/**
 * Side-specific resize limits. The left rail floors at 200px (sessions / files filter input
 * width); the right pane floors at 280px (git commit composer button row).
 *
 * `min` is kept as a back-compat alias for the lowest of the two floors so existing code
 * that doesn't care which side it's on still compiles. Prefer `minLeft` / `minRight` for new
 * code.
 */
export const RAIL_LIMITS = {
  min: MIN_LEFT_WIDTH,
  minLeft: MIN_LEFT_WIDTH,
  minRight: MIN_RIGHT_WIDTH,
  max: MAX_WIDTH,
};
export const RAIL_DEFAULTS = {
  leftWidth: DEFAULT_LEFT_WIDTH,
  rightWidth: DEFAULT_RIGHT_WIDTH,
};
