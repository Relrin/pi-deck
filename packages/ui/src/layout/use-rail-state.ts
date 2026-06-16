import { create } from "zustand";
import { persist } from "zustand/middleware";

const MIN_LEFT_WIDTH = 200;
// The right pane hosts the git commit composer; its two buttons ("commit" + "commit & push")
// are right-aligned and live on a single row. Below ~280px the second button starts to wrap
// or get clipped, which looks broken. Lock the right pane min to that floor so the composer
// always renders cleanly, independent of what the left rail's min is.
const MIN_RIGHT_WIDTH = 280;
// The center column (editor / chat / diff) is never allowed below this — panels can grow
// freely (no fixed max) but stop before they would squeeze the center away. Enforced in JS
// against the live window so the `1fr` body grid never overflows into a horizontal scrollbar.
const MIN_CENTER_WIDTH = 360;
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
  /** Re-clamp both panels against the current window width (call on window resize). */
  clampToWindow: () => void;
}

/**
 * Upper bound for one side's width: whatever is left after the other (visible) panel and
 * the protected center minimum. Falls back to no upper bound when there's no window
 * (tests / SSR) so the floor still applies but nothing caps growth.
 */
function maxWidth(
  side: "left" | "right",
  s: Pick<RailState, "leftWidth" | "rightWidth" | "leftVisible" | "rightVisible">,
): number {
  const floor = side === "left" ? MIN_LEFT_WIDTH : MIN_RIGHT_WIDTH;
  if (typeof window === "undefined") return Number.POSITIVE_INFINITY;
  const other =
    side === "left" ? (s.rightVisible ? s.rightWidth : 0) : s.leftVisible ? s.leftWidth : 0;
  return Math.max(floor, window.innerWidth - other - MIN_CENTER_WIDTH);
}

export const useRailState = create<RailState>()(
  persist(
    (set) => ({
      leftWidth: DEFAULT_LEFT_WIDTH,
      rightWidth: DEFAULT_RIGHT_WIDTH,
      leftVisible: true,
      rightVisible: true,
      setLeftWidth: (px) =>
        set((s) => ({ leftWidth: clamp(px, MIN_LEFT_WIDTH, maxWidth("left", s)) })),
      setRightWidth: (px) =>
        set((s) => ({ rightWidth: clamp(px, MIN_RIGHT_WIDTH, maxWidth("right", s)) })),
      setLeftVisible: (v) => set({ leftVisible: v }),
      setRightVisible: (v) => set({ rightVisible: v }),
      toggleLeft: () => set((s) => ({ leftVisible: !s.leftVisible })),
      toggleRight: () => set((s) => ({ rightVisible: !s.rightVisible })),
      clampToWindow: () =>
        set((s) => ({
          leftWidth: clamp(s.leftWidth, MIN_LEFT_WIDTH, maxWidth("left", s)),
          rightWidth: clamp(s.rightWidth, MIN_RIGHT_WIDTH, maxWidth("right", s)),
        })),
    }),
    {
      name: "pi-deck:rails:v1",
      version: 1,
    },
  ),
);

/**
 * Side-specific resize limits. The left rail floors at 200px (sessions / files filter input
 * width); the right pane floors at 280px (git commit composer button row). There is no fixed
 * upper bound — panels grow until the center hits `minCenter`.
 */
export const RAIL_LIMITS = {
  minLeft: MIN_LEFT_WIDTH,
  minRight: MIN_RIGHT_WIDTH,
  minCenter: MIN_CENTER_WIDTH,
};
export const RAIL_DEFAULTS = {
  leftWidth: DEFAULT_LEFT_WIDTH,
  rightWidth: DEFAULT_RIGHT_WIDTH,
};
