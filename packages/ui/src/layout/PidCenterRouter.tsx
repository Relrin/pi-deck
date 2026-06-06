import { useEffect, useState } from "react";
import { ChatView } from "../features/chat/ChatView";
import {
  selectMessages,
  selectSessionLoaded,
  useMessagesStore,
} from "../features/chat/useMessagesStore";
import { DiffTab } from "../features/diff/DiffTab";
import { PidComposerScreen } from "../features/intro/PidComposerScreen";
import { PidIntroScreen } from "../features/intro/PidIntroScreen";
import { useSessionsStore } from "../features/sessions/useSessionsStore";
import { useNavStore } from "../lib/useNavStore";

const PLACEHOLDER_LABELS: Record<string, string> = {
  editor: "Editor — coming in plan 013",
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

  if (screen === "git-diff") {
    return <DiffTab />;
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
  const loaded = useMessagesStore(selectSessionLoaded(sessionId));
  const timedOut = useHistoryLoadTimeout(sessionId, !loaded);

  if (!loaded && !timedOut) {
    return (
      <div className="pid-route-placeholder">
        <span>Loading session…</span>
      </div>
    );
  }
  if (messages.length === 0) {
    return <PidIntroScreen variant="inline-empty-session" />;
  }
  return <ChatView sessionId={sessionId} />;
}

/** Returns true once `pending` has held for ~10s, reset whenever the session changes. */
function useHistoryLoadTimeout(sessionId: string, pending: boolean): boolean {
  const [timedOut, setTimedOut] = useState(false);
  // switching sessions restarts the timeout even though sessionId isn't read in the body.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sessionId is the reset signal.
  useEffect(() => {
    setTimedOut(false);
    if (!pending) return;
    const timer = setTimeout(() => setTimedOut(true), 10_000);
    return () => clearTimeout(timer);
  }, [sessionId, pending]);
  return timedOut;
}
