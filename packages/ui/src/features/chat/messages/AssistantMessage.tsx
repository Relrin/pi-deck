import { ToolCallCard } from "../tools/ToolCallCard.js";
import type { AssistantMessageEntry } from "../types.js";
import { useMessagesStore } from "../useMessagesStore.js";
import { Markdown } from "./Markdown.js";
import { MessageSurface } from "./MessageSurface.js";
import { StreamingStatus } from "./StreamingStatus.js";

interface AssistantMessageProps {
  message: AssistantMessageEntry;
  sessionId: string;
}

export function AssistantMessage({ message, sessionId }: AssistantMessageProps) {
  const toolCalls = useMessagesStore((s) => s.bySession[sessionId]?.toolCalls);

  return (
    <MessageSurface align="left">
      <div className="select-text" data-selectable-message data-message-raw={message.text}>
        {message.text && (
          // The same `<Markdown>` path runs whether streaming or complete; this kills the
          // pre→markdown reflow on completion. While `isComplete` is false, fenced code
          // renders as plain `<pre>` (no Shiki); the flag flips after `turn.end`.
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
    </MessageSurface>
  );
}
