import { useState } from "react";
import { Check, X } from "../../../components/icons/index.js";
import { humanizeError } from "../../../lib/format/humanize-error.js";
import type { ToolApprovalDecision } from "../../../lib/transport/protocol-client.js";
import { useNotificationStore } from "../../_status/useNotificationStore.js";
import { useSessionsStore } from "../../sessions/useSessionsStore.js";

export interface ApprovalPillProps {
  sessionId: string;
  callId: string;
  approvalId: string;
  /** Plugin-provided context, e.g. "Edit target outside the auto-approve allowlist." */
  reason?: string;
}

/**
 * Inline allow/deny on a tool-call card while the agent-mode plugin waits for a decision.
 *
 * Renders only when a `pendingApproval` is attached to the tool call (set by
 * `applyToolApprovalRequested`). Disappears automatically when the matching
 * `session.tool.call.end` event fires (or the user clicks Allow / Deny) — both branches
 * land in `applyToolCallEnd`, which clears `pendingApproval` from the entry.
 *
 * "Allow always" is intentionally absent — the persistence model for a per-session
 * allowlist isn't designed yet, and the plan's `targetMode` already gives users a one-knob
 * way to flip into accept-edits mode if they want fewer prompts.
 */
export function ApprovalPill({
  sessionId,
  callId: _callId,
  approvalId,
  reason,
}: ApprovalPillProps) {
  const client = useSessionsStore((s) => s.client);
  const notify = useNotificationStore((s) => s.error);
  const [busy, setBusy] = useState<ToolApprovalDecision | null>(null);

  const decide = async (decision: ToolApprovalDecision) => {
    if (!client || busy) return;
    setBusy(decision);
    try {
      await client.toolApproval(sessionId, approvalId, decision);
      // Don't clear `pendingApproval` from the store here — the worker will emit a
      // `session.tool.call.end` shortly (with `isError=true` on deny, success on allow), and
      // `applyToolCallEnd` strips the pending field. Clearing here too would double-clear
      // and is an unnecessary coupling between the pill and the store internals.
    } catch (err) {
      notify(humanizeError(err, `Failed to ${decision === "allow" ? "approve" : "deny"} tool`));
      setBusy(null);
    }
  };

  return (
    <div className="pid-approval-pill">
      {reason && <span className="pid-approval-pill-reason">{reason}</span>}
      <button
        type="button"
        className="pid-approval-pill-action"
        data-variant="allow"
        onClick={() => {
          void decide("allow");
        }}
        disabled={busy !== null}
      >
        <Check size={12} aria-hidden />
        <span>Allow once</span>
      </button>
      <button
        type="button"
        className="pid-approval-pill-action"
        data-variant="deny"
        onClick={() => {
          void decide("deny");
        }}
        disabled={busy !== null}
      >
        <X size={12} aria-hidden />
        <span>Deny</span>
      </button>
    </div>
  );
}
