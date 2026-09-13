import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  ChevronDown,
  Map as MapIcon,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from "../../../components/icons/index.js";
import { useI18nContext } from "../../../i18n/i18n-react.js";
import type { TranslationFunctions } from "../../../i18n/i18n-types.js";
import { humanizeError } from "../../../lib/format/humanize-error.js";
import type { ApprovePlanTargetMode } from "../../../lib/transport/protocol-client.js";
import { useNotificationStore } from "../../_status/useNotificationStore.js";
import { hasPlanChecklist } from "../../plan-panel/parsePlan.js";
import {
  composeCommentsMessage,
  selectPlanComments,
  usePlanCommentsStore,
} from "../../plan-panel/usePlanCommentsStore.js";
import { selectPlanSession, usePlanStore } from "../../plan-panel/usePlanStore.js";
import { useSessionsStore } from "../../sessions/useSessionsStore.js";
import { useComposerStore } from "../composer/useComposerStore.js";
import type { AssistantMessageEntry } from "../types.js";
import { selectTurnInFlight, useMessagesStore } from "../useMessagesStore.js";
import { Markdown } from "./Markdown.js";
import { PlanCommentLayer } from "./PlanCommentLayer.js";

interface TargetMode {
  value: ApprovePlanTargetMode;
  label: string;
  blurb: string;
  Icon: typeof ShieldCheck;
}

/**
 * Built per render — a module constant would freeze the launch locale. `value` is the
 * `ApprovePlanTargetMode` protocol value and stays an identifier.
 */
export function targetModes(t: TranslationFunctions): TargetMode[] {
  const copy = t.chat.planCard.targetMode;
  return [
    {
      value: "ask",
      label: copy.ask.label(),
      blurb: copy.ask.blurb(),
      Icon: ShieldCheck,
    },
    {
      value: "accept-edits",
      label: copy.acceptEdits.label(),
      blurb: copy.acceptEdits.blurb(),
      Icon: CheckCheck,
    },
    {
      value: "auto",
      label: copy.auto.label(),
      blurb: copy.auto.blurb(),
      Icon: Sparkles,
    },
  ];
}

const DEFAULT_TARGET: ApprovePlanTargetMode = "accept-edits";

export interface PlanCardProps {
  message: AssistantMessageEntry;
  sessionId: string;
  isLatest: boolean;
  planMarkdown?: string;
}

/**
 * Wraps a plan-shaped assistant message: same `<Markdown>` body that any other turn would
 * render (so the agent's narrative + checklist + Files/Verification sections all behave
 * normally, including the custom GFM checkbox swap), framed in a subtle card and given an
 * Approve footer when it's the latest assistant turn.
 */
export function PlanCard({ message, sessionId, isLatest, planMarkdown }: PlanCardProps) {
  const client = useSessionsStore((s) => s.client);
  const sendPrompt = useSessionsStore((s) => s.sendPrompt);
  const planSession = usePlanStore(selectPlanSession(sessionId));
  const setLastApproval = usePlanStore((s) => s.setLastApproval);
  const notify = useNotificationStore((s) => s.error);
  const { LL } = useI18nContext();
  const isInFlight = useMessagesStore(useMemo(() => selectTurnInFlight(sessionId), [sessionId]));
  const [busy, setBusy] = useState(false);
  const selectedTarget = planSession.lastApproval?.targetMode ?? DEFAULT_TARGET;

  // Pending review comments anchored to THIS plan card. The offset/highlight root is the
  // `[data-plan-card-body]` div below; `PlanCommentLayer` paints highlights + the inline
  // composer, and "Request changes" submits them as one plan-mode reply.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const commentsSession = usePlanCommentsStore(selectPlanComments(sessionId));
  const clearComments = usePlanCommentsStore((s) => s.clearSession);
  const pendingComments = commentsSession.comments.filter((c) => c.messageId === message.id);
  const pendingCount = pendingComments.length;

  const requestChanges = async () => {
    if (!client || busy || isInFlight || pendingCount === 0) return;
    setBusy(true);
    try {
      await sendPrompt(composeCommentsMessage(pendingComments), { agentMode: "plan" });
      // The agent revises the plan file on this feedback; the anchors no longer apply, so drop
      // the pending comments. `sendPrompt` already toasts on failure — keep them for retry then.
      clearComments(sessionId);
    } catch {
      // handled (toasted) inside sendPrompt
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!client || busy) return;
    setBusy(true);
    try {
      await client.approvePlan(sessionId, selectedTarget, LL.plan.continuation());

      useComposerStore.getState().seed(sessionId, selectedTarget);
      // Re-persist the pick so the next plan in this session pre-selects the same mode. The
      // store is already at this value when the user clicked an option in the picker, but
      // the default fallback wouldn't have written anything yet — write here so the choice
      // sticks even when the user accepted the default and never opened the picker.
      setLastApproval(sessionId, selectedTarget);
    } catch (err) {
      notify(humanizeError(err, LL.chat.errors.approvePlan()));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pid-plan-card" data-plan-card>
      <div className="pid-plan-card-header">
        <MapIcon size={12} aria-hidden />
        <span>{LL.chat.planCard.header()}</span>
      </div>
      <div className="pid-plan-card-body" data-plan-card-body ref={bodyRef}>
        <Markdown text={planMarkdown ?? message.text} isComplete={message.isComplete} />
      </div>
      {isLatest && (
        <PlanCommentLayer sessionId={sessionId} messageId={message.id} bodyRef={bodyRef} />
      )}
      {isLatest && (
        <div className="pid-plan-card-footer">
          {pendingCount > 0 && (
            <button
              type="button"
              className="pid-plan-request-changes"
              aria-label={LL.chat.planCard.reviseAria()}
              onClick={() => {
                void requestChanges();
              }}
              disabled={busy || isInFlight || !client}
            >
              <MessageSquare size={12} aria-hidden />
              <span>{LL.chat.planCard.revise()}</span>
            </button>
          )}
          <span className="pid-plan-card-footer-hint">
            {pendingCount > 0
              ? LL.chat.planCard.commentsPending({ count: pendingCount })
              : LL.chat.planCard.approvingHint()}
          </span>
          <ModeTargetPicker
            selected={selectedTarget}
            disabled={busy}
            onPick={(mode) => setLastApproval(sessionId, mode)}
          />
          <button
            type="button"
            className="pid-plan-approve"
            aria-label={LL.chat.planCard.approveAria()}
            onClick={() => {
              void approve();
            }}
            disabled={busy || !client}
          >
            <Check size={12} aria-hidden />
            <span>{LL.chat.planCard.approve()}</span>
          </button>
        </div>
      )}
    </div>
  );
}

interface ModeTargetPickerProps {
  selected: ApprovePlanTargetMode;
  disabled: boolean;
  onPick: (mode: ApprovePlanTargetMode) => void;
}

/**
 * Secondary pill that opens a small popover for picking the post-approval mode. Mirrors the
 * visual language of the composer's `SessionAgentModePicker` so the affordance reads as
 * "this is a setting, not an action" — the Approve button next to it is the action.
 */
function ModeTargetPicker({ selected, disabled, onPick }: ModeTargetPickerProps) {
  const { LL } = useI18nContext();
  const modes = targetModes(LL);
  const active = modes.find((m) => m.value === selected) ?? modes[1];
  // `targetModes` returns a non-empty literal, but TypeScript's narrowing can't see that across
  // the .find() boundary, so we assert with a defensive fallback.
  if (!active) return null;
  const ActiveIcon = active.Icon;
  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <button
          type="button"
          className="pid-plan-mode-pill"
          aria-label={LL.chat.planCard.targetModeAria({ mode: active.label })}
          disabled={disabled}
        >
          <ActiveIcon size={12} aria-hidden />
          <span>{active.label}</span>
          <ChevronDown size={10} aria-hidden />
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align="end"
          side="top"
          sideOffset={6}
          className="pid-plan-approve-popover"
        >
          {modes.map((m) => {
            const Icon = m.Icon;
            const isActive = m.value === selected;
            return (
              <RadixDropdown.Item
                key={m.value}
                onSelect={() => onPick(m.value)}
                className="pid-plan-approve-popover-item"
                data-active={isActive || undefined}
              >
                <Icon size={14} aria-hidden />
                <span>
                  {m.label}
                  <span className="pid-plan-approve-popover-blurb">{m.blurb}</span>
                </span>
              </RadixDropdown.Item>
            );
          })}
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}

/**
 * Plan-shape detector. The plan-mode system prompt produces markdown with a `Plan` section
 * containing checkbox items; we look for any checklist line in the message body (tolerant of
 * bullet-less / heading-style markers — see `parsePlan`).
 *
 * Two callers feed the mode:
 *   - Fresh turns: `message.agentModeAtTurn` (stamped by `useMessagesStore.newAssistant`).
 *   - Restored sessions: pi's `sessionFile` doesn't carry a per-turn mode tag, so we fall
 *     back to the session's currently-persisted `agentMode`.
 */
export function isPlanShapedMessage(
  message: AssistantMessageEntry,
  currentSessionMode: string | undefined,
): boolean {
  const stampedMode = message.agentModeAtTurn ?? currentSessionMode;
  if (stampedMode !== "plan") return false;
  return planMarkdownHasChecklist(message.text);
}

/** Whether some markdown contains a plan checklist line. Shares the detector with `parsePlan`. */
export function planMarkdownHasChecklist(md: string | null | undefined): boolean {
  return hasPlanChecklist(md);
}
