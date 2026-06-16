import { useEffect } from "react";
import { DiffTab } from "../features/diff/DiffTab";
import { PidEditorView } from "../features/editor/PidEditorView";
import { PidComposerScreen } from "../features/intro/PidComposerScreen";
import { useSessionsStore } from "../features/sessions/useSessionsStore";
import { useNavStore } from "../lib/useNavStore";
import { usePreferencesStore } from "../theme/usePreferencesStore";
import { PidSessionPane } from "./PidSessionPane";

const PLACEHOLDER_LABELS: Record<string, string> = {};

export function PidCenterRouter() {
  const screen = useNavStore((s) => s.screen);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const ide = usePreferencesStore((s) => s.viewMode) === "ide";

  // If we rehydrated to "session" but no session is active, fall back to the blank/start screen
  // so the center column isn't empty.
  useEffect(() => {
    if (screen === "session" && !activeSessionId) {
      useNavStore.getState().goToBlank();
    }
  }, [screen, activeSessionId]);

  // In IDE mode the session lives in the docked right-pane tab, so the center never
  // renders it as a full screen — coerce a leftover `session` screen to the editor.
  useEffect(() => {
    if (ide && screen === "session") {
      useNavStore.getState().setScreen("editor");
    }
  }, [ide, screen]);

  if (screen === "blank") {
    return <PidComposerScreen />;
  }

  if (screen === "session") {
    // While the IDE coercion effect runs, render the editor instead of the session
    // so we don't briefly flash the chat in the center.
    if (ide) {
      return <PidEditorView />;
    }
    return <PidSessionPane />;
  }

  if (screen === "git-diff") {
    return <DiffTab />;
  }

  if (screen === "editor") {
    return <PidEditorView />;
  }

  const label = PLACEHOLDER_LABELS[screen] ?? screen;
  return (
    <div className="pid-route-placeholder">
      <span>{label}</span>
    </div>
  );
}
