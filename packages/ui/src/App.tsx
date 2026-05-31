import { WorkerPoolContextProvider } from "@pierre/diffs/react";
import PierreDiffsWorker from "@pierre/diffs/worker/worker-portable.js?worker";
import { useEffect } from "react";
import { TooltipProvider } from "./components/ui/Tooltip";
import { NotificationCenter } from "./features/_status/NotificationCenter";
import { PidContextPane } from "./features/context/PidContextPane";
import { selectArtefacts, useArtefactsStore } from "./features/context/useArtefactsStore";
import { PidFileTree } from "./features/files/PidFileTree";
import { GitSidebar } from "./features/git/GitSidebar";
import { useGitStore } from "./features/git/useGitStore";
import { PidSessionsList } from "./features/sessions/PidSessionsList";
import { useNewSessionShortcut } from "./features/sessions/useNewSessionShortcut";
import { useProjectsStore } from "./features/sessions/useProjectsStore";
import { useSessionsStore } from "./features/sessions/useSessionsStore";
import { PidSettingsView } from "./features/settings/PidSettingsView";
import { useSettingsHotkey } from "./features/settings/useSettingsHotkey";
import { PidAppShell } from "./layout/PidAppShell";
import { PidBody } from "./layout/PidBody";
import { PidCenterRouter } from "./layout/PidCenterRouter";
import { PidFooter } from "./layout/PidFooter";
import { PidLeftRail } from "./layout/PidLeftRail";
import { PidRightPane } from "./layout/PidRightPane";
import { PidTopBar } from "./layout/PidTopBar";
import { installPideckDevHatch } from "./lib/dev/__pideck";
import { isSessionContextScreen, useNavStore } from "./lib/useNavStore";
import { ThemeProvider } from "./theme/ThemeProvider";

export function App() {
  const initialize = useSessionsStore((s) => s.initialize);
  const projectId = useProjectsStore((s) => s.activeProjectId);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const screen = useNavStore((s) => s.screen);

  const inSessionContext = isSessionContextScreen(screen) && Boolean(activeSessionId);
  const gitCount = useGitStore((s) =>
    projectId && inSessionContext
      ? (s.statusByProject[projectId]?.changes.length ?? undefined)
      : undefined,
  );

  // Context tab badge: count of artefacts the agent has produced this session. We don't add
  // "in scope" attachments because every session has at least one as soon as the user sends a
  // single attachment, which makes the badge noisy. Artefacts are sparser and more meaningful.
  const artefacts = useArtefactsStore(
    selectArtefacts(inSessionContext ? activeSessionId : undefined),
  );
  const contextCount = inSessionContext && artefacts.length > 0 ? artefacts.length : undefined;
  useSettingsHotkey();
  useNewSessionShortcut();

  useEffect(() => {
    initialize().catch((err) => {
      console.error("Failed to initialize session store:", err);
    });
  }, [initialize]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      installPideckDevHatch(() => useSessionsStore.getState().client);
    }
  }, []);

  return (
    <ThemeProvider>
      <TooltipProvider>
        <WorkerPoolContextProvider
          poolOptions={{ workerFactory: () => new PierreDiffsWorker() }}
          highlighterOptions={{}}
        >
          <PidAppShell
            top={<PidTopBar />}
            body={
              <PidBody
                left={<PidLeftRail sessions={<PidSessionsList />} files={<PidFileTree />} />}
                center={<PidCenterRouter />}
                right={
                  <PidRightPane
                    git={<GitSidebar />}
                    context={
                      <PidContextPane sessionId={inSessionContext ? activeSessionId : undefined} />
                    }
                    gitCount={gitCount}
                    contextCount={contextCount}
                    initialTab="git"
                  />
                }
              />
            }
            bottom={<PidFooter />}
          />
          <PidSettingsView />
        </WorkerPoolContextProvider>
        <NotificationCenter />
      </TooltipProvider>
    </ThemeProvider>
  );
}
