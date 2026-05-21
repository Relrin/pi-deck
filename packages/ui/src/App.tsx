import { useEffect } from "react";
import { TooltipProvider } from "./components/ui/Tooltip";
import { Toaster } from "./features/_status/Toaster";
import { GitSidebar } from "./features/git/GitSidebar";
import { useGitStore } from "./features/git/useGitStore";
import { PidSessionsList } from "./features/sessions/PidSessionsList";
import { useNewSessionShortcut } from "./features/sessions/useNewSessionShortcut";
import { useProjectsStore } from "./features/sessions/useProjectsStore";
import { useSessionsStore } from "./features/sessions/useSessionsStore";
import { PidSettingsView } from "./features/settings/PidSettingsView";
import { useSettingsHotkey } from "./features/settings/useSettingsHotkey";
import { ContextTabStub } from "./layout/_stubs/ContextTabStub";
import { FilesTabStub } from "./layout/_stubs/FilesTabStub";
import { PidAppShell } from "./layout/PidAppShell";
import { PidBody } from "./layout/PidBody";
import { PidCenterRouter } from "./layout/PidCenterRouter";
import { PidFooter } from "./layout/PidFooter";
import { PidLeftRail } from "./layout/PidLeftRail";
import { PidRightPane } from "./layout/PidRightPane";
import { PidTopBar } from "./layout/PidTopBar";
import { installPideckDevHatch } from "./lib/dev/__pideck";
import { ThemeProvider } from "./theme/ThemeProvider";

export function App() {
  const initialize = useSessionsStore((s) => s.initialize);
  const projectId = useProjectsStore((s) => s.activeProjectId);
  const gitCount = useGitStore((s) =>
    projectId ? (s.statusByProject[projectId]?.changes.length ?? undefined) : undefined,
  );
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
        <PidAppShell
          top={<PidTopBar />}
          body={
            <PidBody
              left={<PidLeftRail sessions={<PidSessionsList />} files={<FilesTabStub />} />}
              center={<PidCenterRouter />}
              right={
                <PidRightPane
                  git={<GitSidebar />}
                  context={<ContextTabStub />}
                  gitCount={gitCount}
                  initialTab="git"
                />
              }
            />
          }
          bottom={<PidFooter />}
        />
        <PidSettingsView />
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
