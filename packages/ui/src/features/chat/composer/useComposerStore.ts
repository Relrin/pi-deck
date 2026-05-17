import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Permission posture for the agent loop. Mirrors the three permission modes pi exposes
 * conceptually; the renderer doesn't yet forward this to the worker (no SDK setter), so
 * for now this is presentation-only.
 */
export type ExecutionMode = "ask" | "accept-edits" | "plan";

interface ComposerStoreState {
  executionMode: ExecutionMode;
  setMode: (mode: ExecutionMode) => void;
}

/**
 * Local composer state for the prompt input bottom toolbar. As of plan 006, model + thinking
 * level live on the per-session selection in `useProvidersStore`, so this store is reduced
 * to the permission posture only.
 *
 * TODO(protocol): once pi exposes a setter for the permission mode on `AgentSession`, forward
 * the value to the worker on change.
 */
export const useComposerStore = create<ComposerStoreState>()(
  persist(
    (set) => ({
      executionMode: "ask",
      setMode: (executionMode) => set({ executionMode }),
    }),
    { name: "pi-deck:composer" },
  ),
);
