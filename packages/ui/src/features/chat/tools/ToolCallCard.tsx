import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "../../../components/icons/index.js";
import { cn } from "../../../lib/cn.js";
import { formatDuration } from "../../../lib/format/format-duration.js";
import { TOOL_CARD_HIGHLIGHT_MS } from "../../../lib/ui-constants.js";
import { useElapsed } from "../../../lib/useElapsed.js";
import type { ToolCallEntry } from "../types.js";
import { ApprovalPill } from "./ApprovalPill.js";
import { deriveAllowKey } from "./deriveAllowKey.js";
import { DefaultRenderer } from "./renderers/DefaultRenderer.js";
import { StatusIcon } from "./StatusIcon.js";
import { getRenderer, getSummarizer } from "./ToolRendererRegistry.js";

function statusStat(call: ToolCallEntry): { text: string; tone: "ok" | "error" } | undefined {
  if (call.status === "done") return { text: "ok", tone: "ok" };
  if (call.status === "error") {
    return { text: call.errorText ?? "error", tone: "error" };
  }
  return undefined;
}

export function ToolCallCard({ call, sessionId }: { call: ToolCallEntry; sessionId: string }) {
  // Always start collapsed — the header row already shows tool name, summary, and
  // status (incl. error text in the stat column). Users click to open the detail panel.
  //
  // Pending-approval rows auto-expand so the command body is visible while the user
  // decides, and auto-COLLAPSE once approval resolves — the user shouldn't have to clean
  // up after themselves on every allow/deny. Two refs gate this so we never surprise the
  // user:
  //   - `autoExpandedByApprovalRef` — tracks "we, not the user, opened this row for the
  //     approval flow". Only when this ref is true do we auto-collapse when the approval
  //     clears. Cleared by any manual toggle below.
  //   - `prevHasPendingApprovalRef` — lets us react to the *transitions* (false→true and
  //     true→false), not to every render where the flag happens to be set.
  const [expanded, setExpanded] = useState(false);
  const hasPendingApproval = !!call.pendingApproval;
  const autoExpandedByApprovalRef = useRef(false);
  const prevHasPendingApprovalRef = useRef(false);

  useEffect(() => {
    const prev = prevHasPendingApprovalRef.current;
    prevHasPendingApprovalRef.current = hasPendingApproval;

    if (!prev && hasPendingApproval) {
      // Approval just arrived. Open the row, but only claim the auto-expand if it wasn't
      // already open — otherwise we'd surprise-collapse a row the user had manually opened
      // before the approval came in.
      setExpanded((current) => {
        if (current) return current;
        autoExpandedByApprovalRef.current = true;
        return true;
      });
      return;
    }

    if (prev && !hasPendingApproval && autoExpandedByApprovalRef.current) {
      // Approval cleared and *we* were the ones who opened the row. Roll it back so the
      // long-running command body doesn't keep eating screen space after the user has
      // already moved on.
      autoExpandedByApprovalRef.current = false;
      setExpanded(false);
    }
  }, [hasPendingApproval]);

  // Any manual toggle hands control back to the user — we drop the auto-expand claim so the
  // post-approval collapse logic above won't override their choice.
  const toggleExpanded = useCallback(() => {
    autoExpandedByApprovalRef.current = false;
    setExpanded((v) => !v);
  }, []);
  const Renderer = getRenderer(call.name) ?? DefaultRenderer;
  const summary = getSummarizer(call.name)?.(call.input);

  // Flash a subtle ring when the card first appears so the user spots new activity. The
  // "new" window is anchored to the call's stable `startedAt` — NOT the component's mount
  // time — because the message list is virtualized: off-screen cards unmount and remount
  // when scrolled back into view. Anchoring to mount time would re-flash long-finished
  // calls every time the user scrolls past them.
  //
  // The effect depends ONLY on `call.startedAt` (which never changes for a given call), so
  // unrelated parent re-renders can't churn through cleanup/setup cycles and accidentally
  // leave a fired timer un-replaced (the previous incarnation of this code depended on a
  // per-render `Date.now()` value and would lock `highlight` to `true` if a re-render
  // happened to land right as the window expired).
  const [highlight, setHighlight] = useState(
    () => Date.now() - call.startedAt < TOOL_CARD_HIGHLIGHT_MS,
  );
  useEffect(() => {
    if (!highlight) return;
    const remaining = TOOL_CARD_HIGHLIGHT_MS - (Date.now() - call.startedAt);
    if (remaining <= 0) {
      setHighlight(false);
      return;
    }
    const timer = setTimeout(() => setHighlight(false), remaining);
    return () => clearTimeout(timer);
  }, [call.startedAt, highlight]);

  const stat = statusStat(call);
  const summaryText = summary?.text;
  const summaryTitle = summary?.title ?? summaryText ?? call.name;

  const isActive = call.status === "running" || call.status === "pending";
  const liveElapsed = useElapsed(call.startedAt, isActive);
  const finishedDuration =
    call.endedAt !== undefined ? Math.max(0, call.endedAt - call.startedAt) : undefined;
  const durationMs = isActive ? liveElapsed : finishedDuration;
  // Suppress the chip for sub-50ms completions (a wall of fast `glob` / `read` calls
  // shouldn't sprout a "0.0s" everywhere) and while the approval pill owns the row — the
  // timer column competes with the inline approval controls for right-side real estate and
  // the user doesn't need a ticking number while they're deciding.
  const showDuration =
    !hasPendingApproval &&
    durationMs !== undefined &&
    (isActive || call.status === "error" || durationMs >= 50);

  return (
    <div
      className={cn(
        "pid-tool-row transition-shadow duration-300",
        highlight &&
          "motion-safe:shadow-[0_0_0_2px_color-mix(in_oklab,var(--accent)_30%,transparent)]",
      )}
      style={highlight ? { borderColor: "var(--accent)" } : undefined}
      data-pending-approval={hasPendingApproval || undefined}
    >
      <div className="pid-tool-row-head-row">
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls={`tool-call-body-${call.id}`}
          className="pid-tool-row-head"
          title={summaryTitle}
        >
          <span className="pid-tool-row-chev">
            {expanded ? (
              <ChevronDown size={12} aria-hidden />
            ) : (
              <ChevronRight size={12} aria-hidden />
            )}
          </span>
          <StatusIcon status={call.status} toolName={call.name} errorText={call.errorText} />
          <span className="pid-tool-row-tag">{call.name}</span>
          <span className="pid-tool-row-body">{summaryText ?? ""}</span>
          {showDuration && durationMs !== undefined && (
            <span className="pid-tool-row-elapsed">{formatDuration(durationMs)}</span>
          )}
          {stat && (
            <span
              className="pid-tool-row-stat"
              data-tone={stat.tone === "error" ? "error" : undefined}
            >
              {stat.text}
            </span>
          )}
        </button>
        {call.pendingApproval && (
          <ApprovalPill
            sessionId={sessionId}
            callId={call.id}
            approvalId={call.pendingApproval.approvalId}
            reason={call.pendingApproval.reason}
            allowKey={deriveAllowKey(call.name, call.input)}
          />
        )}
      </div>
      {expanded && (
        <div id={`tool-call-body-${call.id}`} className="pid-tool-row-detail">
          <Renderer call={call} />
        </div>
      )}
    </div>
  );
}
