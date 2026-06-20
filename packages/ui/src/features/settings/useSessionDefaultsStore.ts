import type { AgentMode, ThinkingLevel } from "@pi-deck/core/domain/session.js";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Global defaults for new conversations started from the blank/intro screen. These are the
 * single source of truth: the Settings -> Agents & Models switches and the intro composer's
 * Effort / Agent-mode pickers both read and write this store, so picking on either surface
 * updates the same persisted value.
 *
 * Built-in defaults: effort `medium`, agent mode `accept-edits`.
 */
export interface SessionDefaultsState {
  defaultThinkingLevel: ThinkingLevel;
  defaultAgentMode: AgentMode;
  setDefaultThinkingLevel: (level: ThinkingLevel) => void;
  setDefaultAgentMode: (mode: AgentMode) => void;
}

export const useSessionDefaultsStore = create<SessionDefaultsState>()(
  persist(
    (set) => ({
      defaultThinkingLevel: "medium",
      defaultAgentMode: "accept-edits",
      setDefaultThinkingLevel: (defaultThinkingLevel) => set({ defaultThinkingLevel }),
      setDefaultAgentMode: (defaultAgentMode) => set({ defaultAgentMode }),
    }),
    { name: "pi-deck:session-defaults" },
  ),
);
