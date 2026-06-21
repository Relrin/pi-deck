import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ApprovePlanTargetMode } from "../../lib/transport/protocol-client.js";
import {
  selectAssistantMessageCount,
  selectLatestAssistantId,
  useMessagesStore,
} from "../chat/useMessagesStore.js";
import { type PlanStep, type PlanStepStatus, parsePlanSteps, parsePlanTitle } from "./parsePlan.js";

/** Drop a frozen plan snapshot into the transcript roughly every this many assistant turns. */
const SNAPSHOT_EVERY_MESSAGES = 12;

/**
 * A frozen step view captured in a snapshot. Unlike the live `PlanStep`, durations are
 * resolved at capture time so a historical snapshot doesn't keep ticking or re-resolve
 * against later state.
 */
export interface PlanSnapshotStep {
  /** Stable step id (from `parsePlanSteps`) — used as the render key. */
  id: string;
  label?: string;
  description: string;
  status: PlanStepStatus;
  /** Resolved duration: a done step's `[~]`→`[x]` span, or an in-progress step's elapsed-so-far. */
  durationMs?: number;
}

/**
 * A point-in-time capture of the plan, anchored to the assistant turn that was in-flight when
 * it was taken. Rendered inline in the transcript so a long execution keeps a recent
 * plan-state reference in view. In-memory only (see the store's `partialize`).
 */
export interface PlanSnapshot {
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
 * - `panelOpen` mirrors whether the user has the Plan tab selected in the right rail. We
 *   auto-open it the first time a session produces a plan; once the user manually switches
 *   away we honour that choice and don't re-open on subsequent plans for the same session.
 * - `lastApproval` remembers which target mode the user picked in the previous Approve popover.
 * - `title` / `steps` / `stepTimings` are derived from the plan content; `snapshots` is the
 *   running list of frozen captures used for inline progress. All recomputed on every
 *   `applyPlanFileChanged`.
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
  /** Timestamp of the most recent observed transition — fallback baseline for durations. */
  lastProgressAt?: number;
  /** Frozen plan captures dropped into the transcript on a cadence. In-memory only. */
  snapshots: PlanSnapshot[];
  /** Assistant-message count at the last snapshot — paces the cadence. */
  lastSnapshotMsgCount?: number;
}

interface PlanStoreState {
  bySession: Record<string, PlanSessionState>;
  /**
   * Patch in a fresh plan file payload. Called from the event router on every
   * `plan.file.changed`, and after the initial `plan.file.read` round-trip from `PlanPanel`.
   * Auto-opens the panel the first time a non-null content arrives unless the user previously
   * closed it. Also diffs the parsed plan to advance step timings and, on a message cadence,
   * captures a frozen snapshot for inline rendering.
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

type ProgressSlice = Pick<PlanSessionState, "steps" | "stepTimings" | "lastProgressAt">;

/**
 * Diff the freshly-parsed plan against the previous parse and advance timing state: record
 * `startedAt` when a step turns in-progress (`[~]`), `endedAt` when it turns done (`[x]`). The
 * first time a session sees real content we seed the baseline silently — a reopen / restart
 * mid-execution must not be mistaken for live progress.
 */
function computeProgress(
  prev: PlanSessionState,
  nextSteps: PlanStep[],
  now: number,
): ProgressSlice {
  const prevById = new Map((prev.steps ?? []).map((s) => [s.id, s.status] as const));
  const timings: PlanSessionState["stepTimings"] = { ...(prev.stepTimings ?? {}) };
  let lastProgressAt = prev.lastProgressAt;

  for (const step of nextSteps) {
    const before = prevById.get(step.id);
    if (step.status === before) continue;

    if (step.status === "in-progress") {
      timings[step.id] = {
        ...timings[step.id],
        startedAt: timings[step.id]?.startedAt ?? now,
      };
      lastProgressAt = now;
    } else if (step.status === "done") {
      const startedAt = timings[step.id]?.startedAt;
      timings[step.id] = { startedAt, endedAt: now };
      lastProgressAt = now;
    }
  }

  return { steps: nextSteps, stepTimings: timings, lastProgressAt };
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

          // Capture a frozen snapshot on the message cadence, once execution has actually
          // started (≥1 non-pending step). Skipped on first observation so a reopen / restart
          // mid-run doesn't replay a snapshot. Anchored to the in-flight assistant turn so it
          // renders next to the work that produced it.
          let snapshots = prev.snapshots ?? [];
          let lastSnapshotMsgCount = prev.lastSnapshotMsgCount;
          const hasProgressed = nextSteps.some((s) => s.status !== "pending");
          if (!isFirstObservation && hasProgressed) {
            const msgCount = selectAssistantMessageCount(sessionId)(useMessagesStore.getState());
            const baseline = lastSnapshotMsgCount ?? Number.NEGATIVE_INFINITY;
            if (msgCount - baseline >= SNAPSHOT_EVERY_MESSAGES) {
              const anchorMessageId = selectLatestAssistantId(sessionId)(
                useMessagesStore.getState(),
              );
              snapshots = [
                ...snapshots,
                {
                  id: `snap-${anchorMessageId ?? "x"}-${now}`,
                  ...(anchorMessageId ? { anchorMessageId } : {}),
                  at: now,
                  ...(title ? { title } : {}),
                  steps: nextSteps.map((s) => freezeStep(s, progress.stepTimings[s.id], now)),
                },
              ];
              lastSnapshotMsgCount = msgCount;
            }
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
                ...progress,
                snapshots,
                lastSnapshotMsgCount,
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
