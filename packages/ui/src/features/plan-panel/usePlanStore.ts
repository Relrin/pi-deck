import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ApprovePlanTargetMode } from "../../lib/transport/protocol-client.js";
import { selectLatestAssistantId, useMessagesStore } from "../chat/useMessagesStore.js";
import { type PlanStep, type PlanStepStatus, parsePlanSteps, parsePlanTitle } from "./parsePlan.js";

/** A frozen step view captured in a snapshot — durations are resolved at capture time. */
export interface PlanSnapshotStep {
  id: string;
  label?: string;
  description: string;
  status: PlanStepStatus;
  /** A done step's `[~]`→`[x]` span, or an in-progress step's elapsed-at-capture. */
  durationMs?: number;
}

/**
 * A point-in-time capture of the plan, taken whenever a step transitions (starts or finishes)
 * and anchored to the assistant turn in-flight at the time. Rendered once at that point in the
 * transcript — we don't keep a live card pinned in front of the user. In-memory only.
 */
export interface PlanProgressSnapshot {
  id: string;
  anchorMessageId?: string;
  at: number;
  title?: string;
  steps: PlanSnapshotStep[];
}

/**
 * Per-session plan-mode UI state.
 *
 * - `filePath` / `fileContent` come from the host's `plan.file.changed` event stream and the
 *   initial `plan.file.read` round-trip. `fileContent` is `null` when the file does not exist
 *   yet (e.g. before the agent's first plan-mode turn).
 * - `panelOpen` mirrors whether the user has the Plan tab selected in the right rail.
 * - `lastApproval` remembers which target mode the user picked in the previous Approve popover.
 * - `title` / `steps` / `stepTimings` are derived from the plan content. `snapshots` is the log
 *   of per-transition captures rendered inline. All recomputed on every `applyPlanFileChanged`.
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
  /** Plan title (the leading `# heading`), if the agent included one. */
  title?: string;
  /** Parsed steps from the latest plan content (empty when there is no plan yet). */
  steps: PlanStep[];
  /** Per-step start/end timestamps observed from marker transitions. In-memory only. */
  stepTimings: Record<string, { startedAt?: number; endedAt?: number }>;
  /** Per-transition frozen captures, anchored to the turn they happened in. In-memory only. */
  snapshots: PlanProgressSnapshot[];
}

interface PlanStoreState {
  bySession: Record<string, PlanSessionState>;
  /**
   * Patch in a fresh plan file payload. Called from the event router on every
   * `plan.file.changed`, and after the initial `plan.file.read` round-trip from `PlanPanel`.
   * Auto-opens the panel the first time a non-null content arrives unless the user previously
   * closed it. Diffs the parsed plan to advance step timings and, when a step transitions,
   * appends one frozen snapshot anchored to the in-flight turn.
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
  steps: [],
  stepTimings: {},
  snapshots: [],
});

interface ProgressSlice {
  steps: PlanStep[];
  stepTimings: PlanSessionState["stepTimings"];
  /** True when at least one step changed to in-progress or done in this update. */
  transitioned: boolean;
}

/**
 * Diff the freshly-parsed plan against the previous parse: record `startedAt` when a step turns
 * in-progress (`[~]`), `endedAt` when it turns done (`[x]`), and report whether any such
 * transition occurred so the caller can capture a snapshot.
 */
function computeProgress(
  prev: PlanSessionState,
  nextSteps: PlanStep[],
  now: number,
): ProgressSlice {
  const prevById = new Map((prev.steps ?? []).map((s) => [s.id, s.status] as const));
  const timings: PlanSessionState["stepTimings"] = { ...(prev.stepTimings ?? {}) };
  let transitioned = false;

  for (const step of nextSteps) {
    const before = prevById.get(step.id);
    if (step.status === before) continue;
    if (step.status === "in-progress") {
      timings[step.id] = { ...timings[step.id], startedAt: timings[step.id]?.startedAt ?? now };
      transitioned = true;
    } else if (step.status === "done") {
      timings[step.id] = { startedAt: timings[step.id]?.startedAt, endedAt: now };
      transitioned = true;
    }
  }

  return { steps: nextSteps, stepTimings: timings, transitioned };
}

/** Resolve a live step (+ timing) into a frozen snapshot view at time `at`. */
function freezeStep(
  step: PlanStep,
  timing: { startedAt?: number; endedAt?: number } | undefined,
  at: number,
): PlanSnapshotStep {
  const base: PlanSnapshotStep = {
    id: step.id,
    ...(step.label ? { label: step.label } : {}),
    description: step.description,
    status: step.status,
  };
  if (step.status === "done" && timing?.startedAt !== undefined && timing.endedAt !== undefined) {
    return { ...base, durationMs: timing.endedAt - timing.startedAt };
  }
  if (step.status === "in-progress" && timing?.startedAt !== undefined) {
    return { ...base, durationMs: Math.max(0, at - timing.startedAt) };
  }
  return base;
}

export const usePlanStore = create<PlanStoreState>()(
  persist(
    (set) => ({
      bySession: {},

      applyPlanFileChanged: (sessionId, path, content) =>
        set((state) => {
          const prev = state.bySession[sessionId] ?? emptySessionState();
          // Idempotent — drop the update if nothing changed (defensive against replay).
          if (prev.filePath === path && prev.fileContent === content) return state;

          const now = Date.now();
          const isFirstObservation = prev.fileContent === null;
          const nextSteps = parsePlanSteps(content);
          const title = parsePlanTitle(content);
          const progress = computeProgress(prev, nextSteps, now);

          // Auto-open the panel the first time a real plan arrives. Stays closed if the user
          // explicitly closed it; opens regardless on the first plan if they never touched it.
          const shouldAutoOpen =
            !prev.panelClosedByUser && content !== null && content.length > 0 && !prev.panelOpen;

          // Capture one frozen snapshot per transition (a step started or finished), anchored to
          // the in-flight turn, so the card shows once at that point rather than persistently.
          // Skipped on first observation so a reopen / restart mid-run doesn't replay snapshots.
          let snapshots = prev.snapshots ?? [];
          if (!isFirstObservation && progress.transitioned) {
            const anchorMessageId = selectLatestAssistantId(sessionId)(useMessagesStore.getState());
            const snapshot: PlanProgressSnapshot = {
              id: `snap-${anchorMessageId ?? "x"}-${now}`,
              ...(anchorMessageId ? { anchorMessageId } : {}),
              at: now,
              ...(title ? { title } : {}),
              steps: nextSteps.map((s) => freezeStep(s, progress.stepTimings[s.id], now)),
            };
            // Coalesce consecutive transitions within the same turn (e.g. finishing one step and
            // starting the next in separate writes) into a single, latest card for that turn.
            const last = snapshots[snapshots.length - 1];
            snapshots =
              last && last.anchorMessageId === anchorMessageId
                ? [...snapshots.slice(0, -1), snapshot]
                : [...snapshots, snapshot];
          }

          return {
            bySession: {
              ...state.bySession,
              [sessionId]: {
                ...prev,
                filePath: path,
                fileContent: content,
                panelOpen: shouldAutoOpen ? true : prev.panelOpen,
                title,
                steps: progress.steps,
                stepTimings: progress.stepTimings,
                snapshots,
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
      // Don't persist file content or derived progress — the host re-emits content on the next
      // session activate, and timings/snapshots are wall-clock observations that would be stale
      // on restart. Keep the user preferences (open/closed, last approval).
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
              steps: [],
              stepTimings: {},
              snapshots: [],
            } satisfies PlanSessionState,
          ]),
        ),
      }),
      // Backfill defaults on rehydration. Entries persisted by an earlier build predate fields
      // like `snapshots`/`steps`/`stepTimings`; without this, opening such a session would hit
      // `undefined.map`/`.find` in the renderer and blank the app. Spreading `emptySessionState`
      // first guarantees every rehydrated session has the full shape.
      merge: (persisted, current) => {
        const saved =
          (persisted as { bySession?: Record<string, Partial<PlanSessionState>> } | null)
            ?.bySession ?? {};
        const bySession: Record<string, PlanSessionState> = {};
        for (const [id, s] of Object.entries(saved)) {
          bySession[id] = { ...emptySessionState(), ...s };
        }
        return { ...current, bySession };
      },
    },
  ),
);

/** Stable empty so component selectors don't infinitely re-render on missing sessions. */
const EMPTY_STATE: PlanSessionState = Object.freeze(emptySessionState());

export function selectPlanSession(sessionId: string | undefined) {
  return (state: PlanStoreState): PlanSessionState =>
    sessionId ? (state.bySession[sessionId] ?? EMPTY_STATE) : EMPTY_STATE;
}
