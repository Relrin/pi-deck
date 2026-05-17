import { create } from "zustand";
import { persist } from "zustand/middleware";

const MIN_WIDTH = 200;
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
      setLeftWidth: (px) => set({ leftWidth: clamp(px, MIN_WIDTH, MAX_WIDTH) }),
      setRightWidth: (px) => set({ rightWidth: clamp(px, MIN_WIDTH, MAX_WIDTH) }),
      setLeftVisible: (v) => set({ leftVisible: v }),
      setRightVisible: (v) => set({ rightVisible: v }),
      toggleLeft: () => set((s) => ({ leftVisible: !s.leftVisible })),
      toggleRight: () => set((s) => ({ rightVisible: !s.rightVisible })),
    }),
    {
      name: "pi-deck:rails",
      version: 2,
      // v1 → v2 added leftVisible/rightVisible. Default both to true so existing
      // users see no change on upgrade.
      migrate: (persisted, version) => {
        const next = (persisted ?? {}) as Partial<RailState>;
        if (version < 2) {
          next.leftVisible = true;
          next.rightVisible = true;
        }
        return next as RailState;
      },
    },
  ),
);

export const RAIL_LIMITS = { min: MIN_WIDTH, max: MAX_WIDTH };
export const RAIL_DEFAULTS = {
  leftWidth: DEFAULT_LEFT_WIDTH,
  rightWidth: DEFAULT_RIGHT_WIDTH,
};
