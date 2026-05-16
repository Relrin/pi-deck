import { useEffect } from "react";
import { ChatView } from "../features/chat/ChatView";
import { selectMessages, useMessagesStore } from "../features/chat/useMessagesStore";
import { PidIntroScreen } from "../features/intro/PidIntroScreen";
import { PidSessionsOverview } from "../features/sessions/overview/PidSessionsOverview";
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

  // If we rehydrated to "session" but no session is active, fall back to overview so the
  // center column isn't blank.
  useEffect(() => {
    if (screen === "session" && !activeSessionId) {
      useNavStore.getState().goToOverview();
    }
  }, [screen, activeSessionId]);

  if (screen === "overview") {
    return <PidSessionsOverview />;
  }

  if (screen === "session") {
    if (!activeSessionId) {
      return <PidSessionsOverview />;
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
