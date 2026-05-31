import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, X } from "../../../components/icons/index.js";
import { PidKbd } from "../../../components/kbd/PidKbd.js";
import { Tooltip } from "../../../components/ui/Tooltip.js";
import { humanizeError } from "../../../lib/format/humanize-error.js";
import type { ToolApprovalDecision } from "../../../lib/transport/protocol-client.js";
import { useNotificationStore } from "../../_status/useNotificationStore.js";
import { useSessionsStore } from "../../sessions/useSessionsStore.js";
import { useAutoAllowStore } from "./useAutoAllowStore.js";

export interface ApprovalPillProps {
  sessionId: string;
  callId: string;
  approvalId: string;
  /** Plugin-provided context, e.g. "Edit target outside the auto-approve allowlist." */
  reason?: string;
  allowKey: string;
}

/**
 * Inline allow / deny on a tool-call card while the agent-mode plugin waits for a decision.
 *
 * Lives inside the tool-row header (top-right) so the controls sit next to the operation
 * keyword instead of below the row. Three affordances, left to right:
 *   1. "always allow <key>" checkbox — when ticked, an Allow click also remembers `key` in
 *      the session's `useAutoAllowStore`, so future approval requests for the same key
 *      auto-resolve to `allow` on mount (see the mount effect below).
 *   2. "Deny [Esc]" — outline button, also bound to the global Esc keydown.
 *   3. "Allow once [↵]" — filled accent button, also bound to the global Enter keydown.
 *
 * Disappears when the matching `session.tool.call.end` fires (the store strips
 * `pendingApproval` from the entry, ToolCallCard stops rendering the pill).
 *
 * The "always allow" memory is intentionally renderer-side and per-session — there is no
 * protocol surface yet for a persistent allowlist. See `useAutoAllowStore.ts` for the
 * design notes on that choice.
 */
export function ApprovalPill({
  sessionId,
  callId: _callId,
  approvalId,
  reason,
  allowKey,
}: ApprovalPillProps) {
  const client = useSessionsStore((s) => s.client);
  const notify = useNotificationStore((s) => s.error);
  const addAutoAllow = useAutoAllowStore((s) => s.add);
  const isAutoAllowed = useAutoAllowStore((s) => s.has(sessionId, allowKey));
  const [busy, setBusy] = useState<ToolApprovalDecision | null>(null);
  const [alwaysAllow, setAlwaysAllow] = useState(false);
  // Track whether we already fired the auto-allow for this mount so a render churn doesn't
  // double-decide. We also gate on `busy` for the same reason in `decide()`.
  const autoAllowedRef = useRef(false);
  const checkboxId = useId();

  const decide = useCallback(
    async (decision: ToolApprovalDecision) => {
      if (!client || busy) return;
      setBusy(decision);
      try {
        await client.toolApproval(sessionId, approvalId, decision);
        // Stash the allow on the way out — only when the user explicitly opted in via the
        // checkbox AND chose Allow. A denied call with the checkbox ticked is treated as a
        // misclick; we don't trust an "always allow" intent stamped by a Deny press.
        if (decision === "allow" && alwaysAllow) {
          addAutoAllow(sessionId, allowKey);
        }
      } catch (err) {
        notify(humanizeError(err, `Failed to ${decision === "allow" ? "approve" : "deny"} tool`));
        setBusy(null);
      }
    },
    [client, busy, alwaysAllow, addAutoAllow, sessionId, allowKey, approvalId, notify],
  );

  // Auto-allow: if the user has already ticked "always allow <key>" on a previous pill in
  // this session, resolve this one without asking. The `autoAllowedRef` guard prevents a
  // double-fire when the effect re-runs (it re-runs because `decide` is a useCallback whose
  // identity changes with `busy` / store deps).
  useEffect(() => {
    if (!isAutoAllowed || autoAllowedRef.current || busy) return;
    autoAllowedRef.current = true;
    void decide("allow");
  }, [isAutoAllowed, busy, decide]);

  // Global Esc / Enter shortcuts. The handler is re-bound whenever `decide`'s identity
  // shifts so the latest closure (with up-to-date `alwaysAllow` etc.) is always invoked.
  useEffect(() => {
    if (busy) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
      // Don't steal keys while the user is typing in the composer or any other editable
      // surface — Esc on the composer cancels the in-flight turn, Enter sends.
      const target = e.target as HTMLElement | null;
      if (target && isEditableTarget(target)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        void decide("deny");
      } else if (e.key === "Enter") {
        e.preventDefault();
        void decide("allow");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, decide]);

  return (
    <div className="pid-approval-pill" data-busy={busy ?? undefined}>
      {reason && <span className="pid-approval-pill-reason">{reason}</span>}
      <Tooltip content="Allow this command for the rest of the session" side="bottom">
        <label
          className="pid-approval-pill-always"
          htmlFor={checkboxId}
          data-checked={alwaysAllow || undefined}
        >
          <input
            id={checkboxId}
            type="checkbox"
            className="sr-only"
            checked={alwaysAllow}
            onChange={(e) => setAlwaysAllow(e.target.checked)}
            disabled={busy !== null}
          />
          <span className="pid-approval-pill-checkbox" aria-hidden>
            {alwaysAllow && <Check size={9} />}
          </span>
          <span>
            always allow <code className="pid-approval-pill-key">{allowKey}</code>
          </span>
        </label>
      </Tooltip>
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
        <PidKbd keys={["Esc"]} aria-hidden />
      </button>
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
        <PidKbd keys={["Enter"]} aria-hidden />
      </button>
    </div>
  );
}

function isEditableTarget(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}
