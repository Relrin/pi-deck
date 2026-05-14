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
        {message.text &&
          (message.isComplete ? (
            <Markdown text={message.text} isComplete />
          ) : (
            // Streaming path: skip the full markdown re-parse on every delta. Once
            // `isComplete` flips we swap to the styled <Markdown> with Shiki highlighting.
            <pre className="whitespace-pre-wrap break-words font-sans m-0 leading-relaxed">
              {message.text}
            </pre>
          ))}
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
