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
  // "new" window is measured against the call's stable `startedAt` — NOT the component's
  // mount time — because the message list is virtualized: as the user scrolls, off-screen
  // cards unmount and remount when they come back into view. Anchoring to mount time
  // would re-flash long-finished calls every time the user scrolls past them.
  const remainingHighlightMs = Math.max(0, TOOL_CARD_HIGHLIGHT_MS - (Date.now() - call.startedAt));
  const [highlight, setHighlight] = useState(remainingHighlightMs > 0);
  useEffect(() => {
    if (remainingHighlightMs === 0) return;
    const timer = setTimeout(() => setHighlight(false), remainingHighlightMs);
    return () => clearTimeout(timer);
  }, [remainingHighlightMs]);

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
