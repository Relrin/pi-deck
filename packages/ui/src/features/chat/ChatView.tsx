import { useEffect } from "react";
import { usePathDragStore } from "../files/usePathDragStore.js";
import { ReviewBanner } from "../review/ReviewBanner.js";
import { ReviewPanel } from "../review/ReviewPanel.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { TerminalDock } from "../terminal/TerminalDock.js";
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
  const isPathDrag = usePathDragStore((s) => s.isDragging);

  useEffect(() => {
    activate(sessionId).catch(() => {
      // Errors surface via toasts.
    });
  }, [sessionId, activate]);

  return (
    <div
      className="pid-chat-view flex h-full w-full flex-col bg-[var(--bg-0)] text-[var(--ink-0)] overflow-hidden"
      data-path-drag-active={isPathDrag || undefined}
    >
      {session && <ChatHeader session={session} />}
      <MessageList sessionId={sessionId} />
      <ReviewBanner sessionId={sessionId} />
      <MessageInput sessionId={sessionId} />
      <ReviewPanel sessionId={sessionId} />
      <TerminalDock />
    </div>
  );
}
