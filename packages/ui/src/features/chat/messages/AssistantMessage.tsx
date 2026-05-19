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

  return (
    <MessageSurface kind="agent" timestamp={formatMessageTime(message.createdAt)}>
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
