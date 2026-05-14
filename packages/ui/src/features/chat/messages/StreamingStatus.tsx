import { Spinner } from "../../../components/ui/Spinner.js";
import { getSummarizer } from "../tools/ToolRendererRegistry.js";
import type { ToolCallEntry } from "../types.js";

interface StreamingStatusProps {
  toolCalls: Record<string, ToolCallEntry> | undefined;
  toolCallIds: readonly string[];
  hasText: boolean;
}

/**
 * Inline pi-terminal-style activity line: spinner + current action. Shown while a turn
 * is in flight. If a tool is running, names it (with its summarizer-derived blurb).
 * Otherwise falls back to "Thinking…" until first text arrives.
 */
export function StreamingStatus({ toolCalls, toolCallIds, hasText }: StreamingStatusProps) {
  const activeCall = toolCallIds
    .map((id) => toolCalls?.[id])
    .reverse()
    .find(
      (call): call is ToolCallEntry =>
        !!call && (call.status === "pending" || call.status === "running"),
    );

  if (activeCall) {
    const summary = getSummarizer(activeCall.name)?.(activeCall.input);
    return (
      <Row>
        <span className="font-mono text-[var(--color-text)]">{activeCall.name}</span>
        {summary?.text && (
          <span className="font-mono text-[var(--color-text-muted)] truncate">{summary.text}</span>
        )}
      </Row>
    );
  }

  if (!hasText) {
    return (
      <Row>
        <span className="text-[var(--color-text-muted)]">Thinking…</span>
      </Row>
    );
  }

  return null;
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 my-1 text-xs">
      <Spinner size={12} className="text-[var(--color-accent)]" />
      {children}
    </div>
  );
}
