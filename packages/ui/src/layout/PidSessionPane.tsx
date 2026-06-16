import { useEffect, useState } from "react";
import { ChatView } from "../features/chat/ChatView";
import {
  selectMessages,
  selectSessionLoaded,
  useMessagesStore,
} from "../features/chat/useMessagesStore";
import { PidComposerScreen } from "../features/intro/PidComposerScreen";
import { PidIntroScreen } from "../features/intro/PidIntroScreen";
import { useSessionsStore } from "../features/sessions/useSessionsStore";

/**
 * The chat/session surface. Rendered in the center for the `session` screen
 * (agent mode) and inside the right-pane Session tab (IDE mode). With no active
 * session it shows the new-session composer so a session can be started in place.
 */
export function PidSessionPane() {
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  if (!activeSessionId) {
    return <PidComposerScreen />;
  }
  return <SessionRoute sessionId={activeSessionId} />;
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
