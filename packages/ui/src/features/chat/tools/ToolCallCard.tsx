import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "../../../components/icons/index.js";
import { cn } from "../../../lib/cn.js";
import { TOOL_CARD_HIGHLIGHT_MS } from "../../../lib/ui-constants.js";
import type { ToolCallEntry } from "../types.js";
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

export function ToolCallCard({ call }: { call: ToolCallEntry }) {
  // Always start collapsed — the header row already shows tool name, summary, and
  // status (incl. error text in the stat column). Users click to open the detail panel.
  const [expanded, setExpanded] = useState(false);
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

  return (
    <div
      className={cn(
        "pid-tool-row transition-shadow duration-300",
        highlight &&
          "motion-safe:shadow-[0_0_0_2px_color-mix(in_oklab,var(--accent)_30%,transparent)]",
      )}
      style={highlight ? { borderColor: "var(--accent)" } : undefined}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
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
        {stat && (
          <span
            className="pid-tool-row-stat"
            data-tone={stat.tone === "error" ? "error" : undefined}
          >
            {stat.text}
          </span>
        )}
      </button>
      {expanded && (
        <div id={`tool-call-body-${call.id}`} className="pid-tool-row-detail">
          <Renderer call={call} />
        </div>
      )}
    </div>
  );
}
