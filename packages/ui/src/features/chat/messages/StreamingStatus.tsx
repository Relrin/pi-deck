import { RandomSpinner } from "../../../components/ui/RandomSpinner.js";
import { formatDuration } from "../../../lib/format/format-duration.js";
import { useElapsed } from "../../../lib/useElapsed.js";
import { getSummarizer } from "../tools/ToolRendererRegistry.js";
import type { ToolCallEntry } from "../types.js";

interface StreamingStatusProps {
  toolCalls: Record<string, ToolCallEntry> | undefined;
  toolCallIds: readonly string[];
  hasText: boolean;
}

/**
 * Inline pi-terminal-style activity line: spinner + current action. Shown while a turn
 * is in flight.
 */
export function StreamingStatus({ toolCalls, toolCallIds, hasText }: StreamingStatusProps) {
  const activeCall = toolCallIds
    .map((id) => toolCalls?.[id])
    .reverse()
    .find(
      (call): call is ToolCallEntry =>
        !!call && (call.status === "pending" || call.status === "running"),
    );

  const hasPendingApproval = toolCallIds.some((id) => !!toolCalls?.[id]?.pendingApproval);

  // Hook must be invoked unconditionally; gated by `active` so the interval only runs while
  // an active tool exists. Returns 0 when `startedAt` is undefined, which the active-call
  // branch never sees and the Thinking branch ignores.
  const elapsed = useElapsed(activeCall?.startedAt, !!activeCall && !hasPendingApproval);

  if (hasPendingApproval) return null;

  if (activeCall) {
    const summary = getSummarizer(activeCall.name)?.(activeCall.input);
    return (
      <Row elapsed={elapsed}>
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
        <span className="text-[var(--color-text-muted)]">Thinking...</span>
      </Row>
    );
  }

  return null;
}

function Row({ children, elapsed }: { children: React.ReactNode; elapsed?: number }) {
  return (
    <div className="flex items-center gap-2 my-1 text-xs text-[var(--color-accent)]">
      <RandomSpinner />
      {children}
      {elapsed !== undefined && (
        <span className="pid-stream-status-elapsed">{formatDuration(elapsed)}</span>
      )}
    </div>
  );
}
