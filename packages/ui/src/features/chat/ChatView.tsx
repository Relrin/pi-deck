import { useEffect } from "react";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { ChatHeader } from "./ChatHeader.js";
import { MessageInput } from "./MessageInput.js";
import { MessageList } from "./MessageList.js";
import { registerBuiltInRenderers } from "./tools/renderers/register.js";

registerBuiltInRenderers();

interface ChatViewProps {
  sessionId: string;
}

export function ChatView({ sessionId }: ChatViewProps) {
  const session = useSessionsStore((s) => s.sessions.find((x) => x.id === sessionId));
  const activate = useSessionsStore((s) => s.activateSession);

  useEffect(() => {
    activate(sessionId).catch(() => {
      // Errors surface via toasts.
    });
  }, [sessionId, activate]);

  return (
    <div className="flex h-full w-full flex-col bg-[var(--color-bg)] text-[var(--color-text)] overflow-hidden">
      {session && <ChatHeader session={session} />}
      <MessageList sessionId={sessionId} />
      <MessageInput sessionId={sessionId} />
    </div>
  );
}
