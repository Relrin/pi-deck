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
  setLeftWidth: (px: number) => void;
  setRightWidth: (px: number) => void;
}

export const useRailState = create<RailState>()(
  persist(
    (set) => ({
      leftWidth: DEFAULT_LEFT_WIDTH,
      rightWidth: DEFAULT_RIGHT_WIDTH,
      setLeftWidth: (px) => set({ leftWidth: clamp(px, MIN_WIDTH, MAX_WIDTH) }),
      setRightWidth: (px) => set({ rightWidth: clamp(px, MIN_WIDTH, MAX_WIDTH) }),
    }),
    { name: "pi-deck:rails" },
  ),
);

export const RAIL_LIMITS = { min: MIN_WIDTH, max: MAX_WIDTH };
