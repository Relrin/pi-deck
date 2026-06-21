import { cn } from "../../../lib/cn.js";
import { formatDuration } from "../../../lib/format/format-duration.js";
import { useElapsed } from "../../../lib/useElapsed.js";
import type { PlanStepStatus } from "../../plan-panel/parsePlan.js";

/**
 * One rendered step in a plan snapshot. `durationMs` carries a resolved time (a done step's
 * span, or a frozen in-progress elapsed); `startedAt` is only set on the *live* in-progress
 * step so its timer ticks.
 */
export interface PlanSnapshotRow {
  id: string;
  label?: string;
  description: string;
  status: PlanStepStatus;
  durationMs?: number;
  startedAt?: number;
}

export interface PlanSnapshotProps {
  title?: string;
  rows: PlanSnapshotRow[];
}

// Plans up to this many steps render in full; longer ones window around the current step.
const FULL_MAX = 7;
const WINDOW_BEFORE = 3;
const WINDOW_AFTER = 3;

/**
 * The inline "PLAN" card — a status dot + operation label + description + elapsed per step,
 * mirroring the plan-progress mockup. Rendered live under the latest turn (with the current
 * step ticking) and frozen into the transcript on a cadence so a long execution keeps a
 * recent plan-state reference in view. Long plans show a window of ~2-3 completed steps, the
 * current step, and ~2-3 upcoming steps, with counts for what's hidden.
 */
export function PlanSnapshot({ title, rows }: PlanSnapshotProps) {
  if (rows.length === 0) return null;
  const total = rows.length;
  const done = rows.filter((r) => r.status === "done").length;
  const { visible, hiddenBefore, hiddenAfter } = windowRows(rows);
  return (
    <div className="pid-plan-snapshot">
      <div className="pid-plan-snapshot-header">
        <span className="pid-plan-snapshot-chip">Plan</span>
        {title && <span className="pid-plan-snapshot-title">{title}</span>}
      </div>
      <div className="pid-plan-snapshot-steps">
        {hiddenBefore > 0 && (
          <div className="pid-plan-snapshot-more">
            +{hiddenBefore} earlier {hiddenBefore === 1 ? "step" : "steps"}
          </div>
        )}
        {visible.map((row) => (
          <SnapshotRow key={row.id} row={row} />
        ))}
        {hiddenAfter > 0 && (
          <div className="pid-plan-snapshot-more">
            +{hiddenAfter} more {hiddenAfter === 1 ? "step" : "steps"}
          </div>
        )}
      </div>
      <div className="pid-plan-snapshot-summary">
        {done} of {total} done
      </div>
    </div>
  );
}

/** Slice a long plan down to a window centred on the current (or next) step. */
function windowRows(rows: PlanSnapshotRow[]): {
  visible: PlanSnapshotRow[];
  hiddenBefore: number;
  hiddenAfter: number;
} {
  if (rows.length <= FULL_MAX) {
    return { visible: rows, hiddenBefore: 0, hiddenAfter: 0 };
  }
  let focus = rows.findIndex((r) => r.status === "in-progress");
  if (focus < 0) focus = rows.findIndex((r) => r.status === "pending");
  if (focus < 0) focus = rows.length - 1;
  const start = Math.max(0, focus - WINDOW_BEFORE);
  const end = Math.min(rows.length, focus + WINDOW_AFTER + 1);
  return { visible: rows.slice(start, end), hiddenBefore: start, hiddenAfter: rows.length - end };
}

/**
 * Split into its own component so `useElapsed` is called unconditionally (Rules of Hooks) —
 * the timer only ticks for the live in-progress row (`startedAt` set), so other rows pay
 * nothing.
 */
function SnapshotRow({ row }: { row: PlanSnapshotRow }) {
  const live = row.status === "in-progress" && row.startedAt !== undefined;
  const elapsed = useElapsed(row.startedAt, live);
  const timeMs = live ? elapsed : row.durationMs;
  return (
    <div
      className={cn(
        "pid-plan-snapshot-row",
        row.status === "done" && "pid-plan-snapshot-row-done",
        row.status === "in-progress" && "pid-plan-snapshot-row-active",
        row.status === "pending" && "pid-plan-snapshot-row-pending",
      )}
    >
      <span
        className={cn(
          "pid-plan-snapshot-dot",
          row.status === "done" && "pid-plan-snapshot-dot-done",
          row.status === "in-progress" && "pid-plan-snapshot-dot-active",
          row.status === "pending" && "pid-plan-snapshot-dot-pending",
        )}
        aria-hidden
      />
      {row.label && <span className="pid-plan-snapshot-label">{row.label}</span>}
      <span className="pid-plan-snapshot-desc" title={row.description}>
        {row.description}
      </span>
      {timeMs !== undefined && (
        <span className="pid-plan-snapshot-time">{formatDuration(timeMs)}</span>
      )}
    </div>
  );
}
