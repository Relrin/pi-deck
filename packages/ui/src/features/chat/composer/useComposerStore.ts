import { create } from "zustand";
import { persist } from "zustand/middleware";
import { humanizeError } from "../../../lib/format/humanize-error.js";
import { useNotificationStore } from "../../_status/useNotificationStore.js";
import { useSessionsStore } from "../../sessions/useSessionsStore.js";

/**
 * Permission posture for the agent loop. Mirrors the three permission modes pi-deck's
 * agent-mode extension enforces in the worker (plan blocks mutating tools, ask prompts per
 * call, accept-edits allowlists edits).
 */
export type ExecutionMode = "ask" | "accept-edits" | "plan";

const DEFAULT_MODE: ExecutionMode = "ask";

interface ComposerStoreState {
  /** Mode the user has selected, per session. Persisted across reloads. The truth-of-record
   *  is the session's persisted `agentMode` on the host — this map is a renderer-side mirror
   *  that lets the picker render before the server round-trip completes. */
  bySession: Record<string, ExecutionMode>;
  /** Read the mode for a session, falling back to the host's last-known value (from the
   *  session record) and finally to `DEFAULT_MODE` for sessions we've never touched. */
  getMode: (sessionId: string | undefined) => ExecutionMode;
  /** Seed the local mode for a session from its server record. Called on activate so the
   *  picker reflects the persisted mode without waiting for the user to toggle. */
  seed: (sessionId: string, mode: ExecutionMode) => void;
  /** Set the mode for a session and forward to the host. Optimistic — reverts on RPC error
   *  so the picker doesn't lie about what the agent will actually do next. */
  setMode: (sessionId: string, mode: ExecutionMode) => Promise<void>;
}

export const useComposerStore = create<ComposerStoreState>()(
  persist(
    (set, get) => ({
      bySession: {},
      getMode: (sessionId) => {
        if (!sessionId) return DEFAULT_MODE;
        const local = get().bySession[sessionId];
        if (local) return local;
        const summary = useSessionsStore.getState().sessions.find((s) => s.id === sessionId);
        return (summary?.agentMode as ExecutionMode | undefined) ?? DEFAULT_MODE;
      },
      seed: (sessionId, mode) =>
        set((state) => {
          if (state.bySession[sessionId] === mode) return state;
          return { bySession: { ...state.bySession, [sessionId]: mode } };
        }),
      setMode: async (sessionId, mode) => {
        const prev = get().bySession[sessionId];
        set((state) => ({ bySession: { ...state.bySession, [sessionId]: mode } }));
        const client = useSessionsStore.getState().client;
        if (!client) return;
        try {
          await client.call("session.setAgentMode", { sessionId, mode });
        } catch (err) {
          // Roll back the optimistic update — the worker won't act on this mode, so the
          // picker shouldn't claim it does. Toast so the user knows the flip failed.
          set((state) => ({
            bySession: { ...state.bySession, [sessionId]: prev ?? DEFAULT_MODE },
          }));
          useNotificationStore.getState().error(humanizeError(err, "Failed to change agent mode"));
        }
      },
    }),
    { name: "pi-deck:composer" },
  ),
);
