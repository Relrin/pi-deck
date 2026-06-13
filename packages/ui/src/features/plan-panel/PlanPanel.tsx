import { useEffect, useState } from "react";
import { PidIconButton } from "../../components/buttons/PidIconButton.js";
import { Check, Copy, Map as MapIcon } from "../../components/icons/index.js";
import { Tooltip } from "../../components/ui/Tooltip.js";
import { writeClipboard } from "../../lib/clipboard.js";
import { Markdown } from "../chat/messages/Markdown.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { selectPlanSession, usePlanStore } from "./usePlanStore.js";

/**
 * Right-rail Plan tab body. Subscribes to `usePlanStore` for the active session and renders
 * the plan file's content through the shared `<Markdown>` component (so the custom GFM
 * checkbox renderer is engaged the same way it is in the inline plan card).
 *
 * Empty / no-active-session states are deliberately friendly — the panel is not just for
 * power users, it's also the answer to "where do I see the plan after I scroll away".
 *
 * On mount (or active-session change), the panel issues a one-shot `plan.file.read` to the
 * host. That priming call:
 *   1. Returns the current file content immediately so we don't wait for the next watcher
 *      event.
 *   2. Lazily starts the host-side watcher if it wasn't already running (e.g. for a session
 *      activated before the user opened the panel).
 *
 * Subsequent live updates flow through `plan.file.changed` → `applyPlanFileChanged`.
 */
export function PlanPanel() {
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const client = useSessionsStore((s) => s.client);
  const plan = usePlanStore(selectPlanSession(activeSessionId));
  const applyPlanFileChanged = usePlanStore((s) => s.applyPlanFileChanged);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!plan.fileContent) return;
    writeClipboard(plan.fileContent)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // Silent failure — the button remains clickable for retry
      });
  };

  // Prime the panel: pull the current content, kick the watcher if it isn't running yet. The
  // host returns `content: null` for sessions that haven't produced a plan yet, which the
  // empty-state branch below handles.
  useEffect(() => {
    if (!activeSessionId || !client) return;
    let cancelled = false;
    client
      .planFileRead(activeSessionId)
      .then((res) => {
        if (cancelled) return;
        applyPlanFileChanged(activeSessionId, res.path, res.content);
      })
      .catch(() => {
        // Non-fatal — the watcher's next event will heal state. We intentionally don't toast
        // here because the panel renders an empty state on undefined content already.
      });
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, client, applyPlanFileChanged]);

  if (!activeSessionId) {
    return (
      <div className="pid-plan-panel" data-testid="plan-panel">
        <div className="pid-plan-panel-empty">
          <MapIcon size={18} aria-hidden />
          <span>Open a session to see its plan.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pid-plan-panel" data-testid="plan-panel">
      <div className="pid-plan-panel-header">
        <span>Plan</span>
        <div className="pid-plan-panel-header-actions">
          {plan.filePath && (
            <span className="pid-plan-panel-path" title={plan.filePath}>
              {shortenPath(plan.filePath)}
            </span>
          )}
          {plan.fileContent && plan.fileContent.length > 0 && (
            <Tooltip content={copied ? "Copied!" : "Copy as Markdown"}>
              <PidIconButton
                icon={copied ? <Check size={14} /> : <Copy size={14} />}
                label="Copy plan as Markdown"
                onClick={handleCopy}
              />
            </Tooltip>
          )}
        </div>
      </div>
      <div className="pid-plan-panel-body">
        {plan.fileContent && plan.fileContent.length > 0 ? (
          <Markdown text={plan.fileContent} isComplete={true} />
        ) : (
          <div className="pid-plan-panel-empty">
            <MapIcon size={18} aria-hidden />
            <span>
              No plan yet. Switch the composer to plan mode and send a prompt — the agent will write
              the plan here.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Trim a long absolute path to its last two segments (e.g. `…/plans/abc.md`) so the panel
 * header doesn't dominate the title bar on deep paths. The full path is on the `title`
 * attribute for users who want to copy it.
 */
function shortenPath(path: string): string {
  const parts = path.split("/");
  if (parts.length <= 2) return path;
  return `…/${parts.slice(-2).join("/")}`;
}
