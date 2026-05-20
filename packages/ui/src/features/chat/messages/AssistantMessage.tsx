import { useMemo } from "react";
import { useProvidersStore } from "../../models/useProvidersStore.js";
import { ToolCallCard } from "../tools/ToolCallCard.js";
import type { AssistantMessageEntry } from "../types.js";
import { useMessagesStore } from "../useMessagesStore.js";
import { Markdown } from "./Markdown.js";
import { MessageContextMenu } from "./MessageContextMenu.js";
import { MessageSurface } from "./MessageSurface.js";
import { StreamingStatus } from "./StreamingStatus.js";
import { formatMessageTime } from "./time.js";

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

  return (
    <MessageSurface
      kind="agent"
      timestamp={formatMessageTime(message.createdAt)}
      agentLabel={modelLabel}
      agentTitle={message.model}
    >
      <MessageContextMenu rawText={message.text}>
        <div className="select-text" data-selectable-message data-message-raw={message.text}>
          {message.text && (
            <div
              role="status"
              aria-live={message.isComplete ? undefined : "polite"}
              aria-atomic="false"
            >
              <Markdown text={message.text} isComplete={message.isComplete} />
            </div>
          )}
          {message.toolCallIds.map((callId) => {
            const call = toolCalls?.[callId];
            if (!call) return null;
            return <ToolCallCard key={callId} call={call} />;
          })}
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
