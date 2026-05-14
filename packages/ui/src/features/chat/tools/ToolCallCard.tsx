import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "../../../components/icons/index.js";
import { cn } from "../../../lib/cn.js";
import { TOOL_CARD_HIGHLIGHT_MS } from "../../../lib/ui-constants.js";
import type { ToolCallEntry } from "../types.js";
import { DefaultRenderer } from "./renderers/DefaultRenderer.js";
import { StatusIcon } from "./StatusIcon.js";
import { getRenderer, getSummarizer } from "./ToolRendererRegistry.js";

export function ToolCallCard({ call }: { call: ToolCallEntry }) {
  const defaultExpanded =
    call.status === "running" || call.status === "pending" || call.status === "error";
  const [expanded, setExpanded] = useState(defaultExpanded);
  const Renderer = getRenderer(call.name) ?? DefaultRenderer;
  const summary = getSummarizer(call.name)?.(call.input);

  // Flash a subtle ring when this card first appears so the user spots the new activity.
  // Triggered on the initial mount only; persists for TOOL_CARD_HIGHLIGHT_MS.
  const [highlight, setHighlight] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    timerRef.current = setTimeout(() => setHighlight(false), TOOL_CARD_HIGHLIGHT_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      className={cn(
        "my-2 rounded-[var(--radius-md)] border bg-[var(--color-panel)] text-sm transition-shadow duration-300",
        highlight
          ? "border-[var(--color-accent)] motion-safe:shadow-[0_0_0_2px_color-mix(in_oklab,var(--color-accent)_30%,transparent)]"
          : "border-[var(--color-border)]",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={`tool-call-body-${call.id}`}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-panel-hover)] transition-colors rounded-t-[var(--radius-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <StatusIcon status={call.status} toolName={call.name} errorText={call.errorText} />
        <span className="font-mono text-xs text-[var(--color-text)]">{call.name}</span>
        {summary?.text && (
          <span
            className="font-mono text-xs text-[var(--color-text-muted)] truncate min-w-0"
            title={summary.title ?? summary.text}
          >
            {summary.text}
          </span>
        )}
        {call.status === "error" && call.errorText && (
          <span
            className="ml-auto text-xs text-[var(--color-danger)] truncate max-w-[24rem]"
            title={call.errorText}
          >
            {call.errorText}
          </span>
        )}
      </button>
      <div
        id={`tool-call-body-${call.id}`}
        hidden={!expanded}
        className={cn(
          "border-t border-[var(--color-border)] p-3 text-xs",
          expanded ? "block" : "hidden",
        )}
      >
        <Renderer call={call} />
      </div>
    </div>
  );
}
