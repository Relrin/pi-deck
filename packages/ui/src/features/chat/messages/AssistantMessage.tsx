import { useMemo } from "react";
import { useProvidersStore } from "../../models/useProvidersStore.js";
import { selectPlanSession, usePlanStore } from "../../plan-panel/usePlanStore.js";
import { useComposerStore } from "../composer/useComposerStore.js";
import { ToolCallCard } from "../tools/ToolCallCard.js";
import type { AssistantMessageEntry } from "../types.js";
import { selectLatestAssistantId, useMessagesStore } from "../useMessagesStore.js";
import { Markdown } from "./Markdown.js";
import { MessageContextMenu } from "./MessageContextMenu.js";
import { MessageSurface } from "./MessageSurface.js";
import { isPlanShapedMessage, PlanCard, planMarkdownHasChecklist } from "./PlanCard.js";
import { PlanSnapshot, type PlanSnapshotRow } from "./PlanSnapshot.js";
import { StreamingStatus } from "./StreamingStatus.js";
import { formatMessageTime, formatMessageTimestampFull } from "./time.js";

interface AssistantMessageProps {
  message: AssistantMessageEntry;
  sessionId: string;
}

export function AssistantMessage({ message, sessionId }: AssistantMessageProps) {
  const toolCalls = useMessagesStore((s) => s.bySession[sessionId]?.toolCalls);
  // Resolve pi's raw model id (e.g. "claude-opus-4-5") into the friendly label from the
  // provider registry (e.g. "Claude Opus 4.5") so the header tag stays readable. Falls
  // back to the raw id when the model isn't in any loaded provider list. We also strip
  // a leading "Provider: " / "Provider — " prefix from the label so the row shows just
  // the model name (the provider is already implicit in the model and would otherwise
  // crowd out the model itself).
  const modelsByProvider = useProvidersStore((s) => s.modelsByProvider);
  const modelLabel = useMemo(() => {
    if (!message.model) return undefined;
    for (const models of Object.values(modelsByProvider)) {
      const hit = models.find((m) => m.id === message.model);
      if (hit) return stripProviderPrefix(hit.label);
    }
    return stripProviderPrefix(message.model);
  }, [message.model, modelsByProvider]);

  // Plan-shape detection. Two inputs feed it:
  // 1. `agentModeAtTurn` — stamped on bubble creation for fresh turns.
  // 2. `sessionAgentMode` — fallback for resumed sessions where the stamp is missing because
  //    pi's sessionFile doesn't carry per-turn mode metadata.
  const sessionAgentMode = useComposerStore((s) => s.getMode(sessionId));
  const isPlan = isPlanShapedMessage(message, sessionAgentMode);
  const stampedPlanMode = (message.agentModeAtTurn ?? sessionAgentMode) === "plan";
  // The Approve / Revise footer only renders on the most recent assistant turn. Stale plans
  // (i.e. ones with a later assistant turn after them) keep the card chrome but drop the
  // footer so users can't re-approve work that has already moved on.
  const latestAssistantId = useMessagesStore(
    useMemo(() => selectLatestAssistantId(sessionId), [sessionId]),
  );
  const isLatestAssistant = latestAssistantId === message.id;

  // Inline plan snapshot. The agent drives progress by editing its plan file
  // (`[ ]`→`[~]`→`[x]`); `usePlanStore` parses it and freezes periodic captures. We render a
  // live card under the latest executing turn (current step ticking) and the frozen capture
  // anchored to any earlier turn, so a long run keeps a recent plan-state reference in view.
  const plan = usePlanStore(selectPlanSession(sessionId));
  // Defensive defaults: a session rehydrated from an older persisted shape may lack these
  // arrays. `usePlanStore`'s merge backfills them, but guarding here keeps a render crash from
  // ever blanking the app on a stale entry.
  const planSteps = plan.steps ?? [];
  const planStepTimings = plan.stepTimings ?? {};
  const planSnapshots = plan.snapshots ?? [];
  const liveRows = useMemo<PlanSnapshotRow[]>(
    () =>
      planSteps.map((s) => {
        const t = planStepTimings[s.id];
        const base = {
          id: s.id,
          ...(s.label ? { label: s.label } : {}),
          description: s.description,
        };
        if (s.status === "done") {
          const durationMs =
            t?.startedAt !== undefined && t.endedAt !== undefined
              ? t.endedAt - t.startedAt
              : undefined;
          return { ...base, status: "done", ...(durationMs !== undefined ? { durationMs } : {}) };
        }
        if (s.status === "in-progress") {
          return { ...base, status: "in-progress", startedAt: t?.startedAt };
        }
        return { ...base, status: "pending" };
      }),
    [planSteps, planStepTimings],
  );
  const total = planSteps.length;
  const doneCount = planSteps.filter((s) => s.status === "done").length;
  const hasInProgress = planSteps.some((s) => s.status === "in-progress");
  // Show the live card while a plan is mid-execution: at least one step active or partly done,
  // but not the freshly-proposed plan (that already renders as the PlanCard) and not a finished
  // or stale plan on an unrelated later turn.
  const showLive =
    isLatestAssistant &&
    !isPlan &&
    total > 0 &&
    (hasInProgress || (doneCount > 0 && doneCount < total));
  const frozenSnapshot = useMemo(
    () => planSnapshots.find((s) => s.anchorMessageId === message.id),
    [planSnapshots, message.id],
  );
  // Fallback for models that write the plan to the file but don't echo the checklist in their
  // message (e.g. Kimi): on the active plan proposal, source the inline card from the plan
  // file so the user still sees it in the conversation instead of opening the file.
  const planFromFile =
    !isPlan && stampedPlanMode && isLatestAssistant && planMarkdownHasChecklist(plan.fileContent);

  return (
    <MessageSurface
      kind="agent"
      timestamp={formatMessageTime(message.createdAt)}
      timestampTitle={formatMessageTimestampFull(message.createdAt)}
      agentLabel={modelLabel}
      agentTitle={message.model}
    >
      <MessageContextMenu rawText={message.text}>
        <div className="select-text" data-selectable-message data-message-raw={message.text}>
          {isPlan ? (
            <div
              role="status"
              aria-live={message.isComplete ? undefined : "polite"}
              aria-atomic="false"
            >
              <PlanCard
                message={message}
                sessionId={sessionId}
                isLatest={isLatestAssistant && message.isComplete}
              />
            </div>
          ) : (
            <>
              {message.text && (
                <div
                  role="status"
                  aria-live={message.isComplete ? undefined : "polite"}
                  aria-atomic="false"
                >
                  <Markdown text={message.text} isComplete={message.isComplete} />
                </div>
              )}
              {planFromFile && (
                <div role="status" aria-live="polite" aria-atomic="false">
                  <PlanCard
                    message={message}
                    sessionId={sessionId}
                    isLatest={isLatestAssistant && message.isComplete}
                    planMarkdown={plan.fileContent ?? undefined}
                  />
                </div>
              )}
            </>
          )}
          {message.toolCallIds.map((callId) => {
            const call = toolCalls?.[callId];
            if (!call) return null;
            // Suppress nameless ghost calls.
            if (!call.name?.trim()) return null;
            return <ToolCallCard key={callId} call={call} sessionId={sessionId} />;
          })}
          {showLive ? (
            <PlanSnapshot title={plan.title} rows={liveRows} />
          ) : frozenSnapshot ? (
            <PlanSnapshot title={frozenSnapshot.title} rows={frozenSnapshot.steps} />
          ) : null}
          {!message.isComplete && (
            <StreamingStatus
              toolCalls={toolCalls}
              toolCallIds={message.toolCallIds}
              hasText={message.text.length > 0}
            />
          )}
        </div>
      </MessageContextMenu>
    </MessageSurface>
  );
}

// Some provider labels carry a "<Provider>: <Model>" or "<Provider> — <Model>" prefix
// (e.g. "Anthropic: Claude Sonnet 4.5"). Strip everything up to and including the first
// separator so the model row stays focused on the model name itself.
const PROVIDER_PREFIX_RE = /^[^:—]+(?:\s*[:—]\s*)(.+)$/;
function stripProviderPrefix(label: string): string {
  const m = PROVIDER_PREFIX_RE.exec(label);
  return m?.[1]?.trim() || label;
}
