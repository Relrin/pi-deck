import { ToolCallCard } from "../tools/ToolCallCard.js";
import type { AssistantMessageEntry } from "../types.js";
import { useMessagesStore } from "../useMessagesStore.js";
import { Markdown } from "./Markdown.js";
import { MessageSurface } from "./MessageSurface.js";

interface AssistantMessageProps {
  message: AssistantMessageEntry;
  sessionId: string;
}

export function AssistantMessage({ message, sessionId }: AssistantMessageProps) {
  const toolCalls = useMessagesStore((s) => s.bySession[sessionId]?.toolCalls);

  return (
    <MessageSurface align="left">
      {message.text &&
        (message.isComplete ? (
          <Markdown text={message.text} isComplete />
        ) : (
          // Streaming path: skip the full markdown re-parse on every delta. Once `isComplete`
          // flips, we swap to the styled <Markdown> with Shiki-highlighted code fences.
          <pre className="whitespace-pre-wrap break-words font-sans m-0 leading-relaxed">
            {message.text}
          </pre>
        ))}
      {message.toolCallIds.map((callId) => {
        const call = toolCalls?.[callId];
        if (!call) return null;
        return <ToolCallCard key={callId} call={call} />;
      })}
      {!message.isComplete && !message.text && message.toolCallIds.length === 0 && (
        <span className="inline-block w-2 h-4 align-text-bottom bg-[var(--color-text-muted)] animate-pulse" />
      )}
    </MessageSurface>
  );
}
