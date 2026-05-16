import { create } from "zustand";
import { persist } from "zustand/middleware";

const MIN_PANEL_WIDTH = 180;
const MAX_PANEL_WIDTH = 520;
const DEFAULT_LEFT_WIDTH = 260;
const DEFAULT_RIGHT_WIDTH = 340;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export type SidePanelState = {
  width: number;
  collapsed: boolean;
};

export type PanelState = {
  left: SidePanelState;
  right: SidePanelState;
  setLeftWidth: (px: number) => void;
  setRightWidth: (px: number) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
};

export const usePanelState = create<PanelState>()(
  persist(
    (set) => ({
      left: { width: DEFAULT_LEFT_WIDTH, collapsed: false },
      right: { width: DEFAULT_RIGHT_WIDTH, collapsed: false },
      setLeftWidth: (px) =>
        set((state) => ({
          left: { ...state.left, width: clamp(px, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH) },
        })),
      setRightWidth: (px) =>
        set((state) => ({
          right: { ...state.right, width: clamp(px, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH) },
        })),
      toggleLeft: () =>
        set((state) => ({ left: { ...state.left, collapsed: !state.left.collapsed } })),
      toggleRight: () =>
        set((state) => ({ right: { ...state.right, collapsed: !state.right.collapsed } })),
    }),
    { name: "pi-deck:panels" },
  ),
);

export const PANEL_LIMITS = {
  min: MIN_PANEL_WIDTH,
  max: MAX_PANEL_WIDTH,
};
