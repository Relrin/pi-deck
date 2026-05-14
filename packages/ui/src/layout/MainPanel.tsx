import { ChatView } from "../features/chat/ChatView";
import { EmptyState } from "../features/chat/EmptyState";
import { useSessionsStore } from "../features/sessions/useSessionsStore";

export function MainPanel() {
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);

  if (activeSessionId) {
    return <ChatView sessionId={activeSessionId} />;
  }

  return <EmptyState />;
}
