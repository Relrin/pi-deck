import { useEffect } from "react";
import { ChatView } from "../features/chat/ChatView";
import { selectMessages, useMessagesStore } from "../features/chat/useMessagesStore";
import { PidComposerScreen } from "../features/intro/PidComposerScreen";
import { PidIntroScreen } from "../features/intro/PidIntroScreen";
import { useSessionsStore } from "../features/sessions/useSessionsStore";
import { useNavStore } from "../lib/useNavStore";

const PLACEHOLDER_LABELS: Record<string, string> = {
  editor: "Editor — coming in plan 013",
  "git-diff": "Diff viewer — coming in plan 008",
  "git-history": "History — coming in plan 007",
};

export function PidCenterRouter() {
  const screen = useNavStore((s) => s.screen);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);

  // If we rehydrated to "session" but no session is active, fall back to the blank/start screen
  // so the center column isn't empty.
  useEffect(() => {
    if (screen === "session" && !activeSessionId) {
      useNavStore.getState().goToBlank();
    }
  }, [screen, activeSessionId]);

  if (screen === "blank") {
    return <PidComposerScreen />;
  }

  if (screen === "session") {
    if (!activeSessionId) {
      return <PidComposerScreen />;
    }
    return <SessionRoute sessionId={activeSessionId} />;
  }

  const label = PLACEHOLDER_LABELS[screen] ?? screen;
  return (
    <div className="pid-route-placeholder">
      <span>{label}</span>
    </div>
  );
}

function SessionRoute({ sessionId }: { sessionId: string }) {
  const messages = useMessagesStore(selectMessages(sessionId));
  if (messages.length === 0) {
    return <PidIntroScreen variant="inline-empty-session" />;
  }
  return <ChatView sessionId={sessionId} />;
}
