import { useState } from "react";
import { ChevronDown, ChevronRight } from "../../../components/icons/index.js";
import { cn } from "../../../lib/cn.js";
import type { ToolCallEntry } from "../types.js";
import { DefaultRenderer } from "./renderers/DefaultRenderer.js";
import { StatusIcon } from "./StatusIcon.js";
import { getRenderer, getSummarizer } from "./ToolRendererRegistry.js";

export function ToolCallCard({ call }: { call: ToolCallEntry }) {
  const defaultExpanded = call.status === "running" || call.status === "error";
  const [expanded, setExpanded] = useState(defaultExpanded);
  const Renderer = getRenderer(call.name) ?? DefaultRenderer;
  const summary = getSummarizer(call.name)?.(call.input);

  return (
    <div className="my-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-panel)] text-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-panel-hover)] rounded-t-[var(--radius-md)]"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <StatusIcon status={call.status} />
        <span className="font-mono text-xs text-[var(--color-text)]">{call.name}</span>
        {summary?.text && (
          <span className="font-mono text-xs text-[var(--color-text-muted)] truncate">
            {summary.text}
          </span>
        )}
        {call.status === "error" && call.errorText && (
          <span className="ml-auto text-xs text-[var(--color-danger)] truncate max-w-[24rem]">
            {call.errorText}
          </span>
        )}
      </button>
      {expanded && (
        <div className={cn("border-t border-[var(--color-border)] p-3 text-xs")}>
          <Renderer call={call} />
        </div>
      )}
    </div>
  );
}
