import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ApprovePlanTargetMode } from "../../lib/transport/protocol-client.js";

/**
 * Per-session plan-mode UI state.
 *
 * - `filePath` / `fileContent` come from the host's `plan.file.changed` event stream and the
 *   initial `plan.file.read` round-trip. `fileContent` is `null` when the file does not exist
 *   yet (e.g. before the agent's first plan-mode turn).
 * - `panelOpen` mirrors whether the user has the Plan tab selected in the right rail. We
 *   auto-open it the first time a session produces a plan; once the user manually switches
 *   away we honour that choice and don't re-open on subsequent plans for the same session.
 * - `lastApproval` remembers which target mode the user picked in the previous Approve popover
 *   for this session, so the picker pre-selects it next time. Per-session because users tend
 *   to settle on `ask` for one project and `accept-edits` for another.
 */
interface PlanSessionState {
  filePath: string | null;
  fileContent: string | null;
  /**
   * True if the panel was at some point open for this session — used to (a) auto-select the
   * Plan tab the first time a plan appears, (b) restore the tab on app restart, (c) skip the
   * auto-open after the user closed it.
   */
  panelOpen: boolean;
  /** True if the user has manually closed the panel — sticky decision until they reopen. */
  panelClosedByUser: boolean;
  lastApproval: { targetMode: ApprovePlanTargetMode } | null;
}

interface PlanStoreState {
  bySession: Record<string, PlanSessionState>;
  /**
   * Patch in a fresh plan file payload. Called from the event router on every
   * `plan.file.changed`, and after the initial `plan.file.read` round-trip from `PlanPanel`.
   * Auto-opens the panel the first time a non-null content arrives unless the user previously
   * closed it.
   */
  applyPlanFileChanged: (sessionId: string, path: string, content: string | null) => void;
  /** Toggle the panel open/closed; sticky in the persisted slice. */
  setPanelOpen: (sessionId: string, open: boolean) => void;
  /** Record the user's chosen target mode so the popover starts there next time. */
  setLastApproval: (sessionId: string, targetMode: ApprovePlanTargetMode) => void;
  /** Drop a session entirely (e.g. on session.delete). */
  clearSession: (sessionId: string) => void;
}

const emptySessionState = (): PlanSessionState => ({
  filePath: null,
  fileContent: null,
  panelOpen: false,
  panelClosedByUser: false,
  lastApproval: null,
});

export const usePlanStore = create<PlanStoreState>()(
  persist(
    (set) => ({
      bySession: {},

      applyPlanFileChanged: (sessionId, path, content) =>
        set((state) => {
          const prev = state.bySession[sessionId] ?? emptySessionState();
          // Idempotent — drop the update if nothing changed (defensive against replay).
          if (prev.filePath === path && prev.fileContent === content) return state;
          // Auto-open the panel the first time a real plan arrives. Stays closed if the user
          // explicitly closed it; opens regardless on the first plan if they never touched it.
          const shouldAutoOpen =
            !prev.panelClosedByUser && content !== null && content.length > 0 && !prev.panelOpen;
          return {
            bySession: {
              ...state.bySession,
              [sessionId]: {
                ...prev,
                filePath: path,
                fileContent: content,
                panelOpen: shouldAutoOpen ? true : prev.panelOpen,
              },
            },
          };
        }),

      setPanelOpen: (sessionId, open) =>
        set((state) => {
          const prev = state.bySession[sessionId] ?? emptySessionState();
          if (prev.panelOpen === open) return state;
          return {
            bySession: {
              ...state.bySession,
              [sessionId]: {
                ...prev,
                panelOpen: open,
                // Track explicit closes so we don't auto-reopen on the next plan-file event.
                panelClosedByUser: !open,
              },
            },
          };
        }),

      setLastApproval: (sessionId, targetMode) =>
        set((state) => {
          const prev = state.bySession[sessionId] ?? emptySessionState();
          return {
            bySession: {
              ...state.bySession,
              [sessionId]: { ...prev, lastApproval: { targetMode } },
            },
          };
        }),

      clearSession: (sessionId) =>
        set((state) => {
          if (!state.bySession[sessionId]) return state;
          const next = { ...state.bySession };
          delete next[sessionId];
          return { bySession: next };
        }),
    }),
    {
      name: "pi-deck:plan-panel",
      // Don't persist the file content — the host re-emits it on the next session activate, and
      // we don't want stale-on-disk content showing up briefly after a restart. Keep the user
      // preferences (open/closed, last approval) so the panel restores its visibility.
      partialize: (state) => ({
        bySession: Object.fromEntries(
          Object.entries(state.bySession).map(([id, s]) => [
            id,
            {
              filePath: null,
              fileContent: null,
              panelOpen: s.panelOpen,
              panelClosedByUser: s.panelClosedByUser,
              lastApproval: s.lastApproval,
            } satisfies PlanSessionState,
          ]),
        ),
      }),
    },
  ),
);

/** Stable empty so component selectors don't infinitely re-render on missing sessions. */
const EMPTY_STATE: PlanSessionState = Object.freeze(emptySessionState());

export function selectPlanSession(sessionId: string | undefined) {
  return (state: PlanStoreState): PlanSessionState =>
    sessionId ? (state.bySession[sessionId] ?? EMPTY_STATE) : EMPTY_STATE;
}
