import { useEffect } from "react";
import { TooltipProvider } from "./components/ui/Tooltip";
import { Toaster } from "./features/_status/Toaster";
import { SessionsList } from "./features/sessions/SessionsList";
import { useSessionsStore } from "./features/sessions/useSessionsStore";
import { FilesTabStub } from "./layout/_stubs/FilesTabStub";
import { GitTabStub } from "./layout/_stubs/GitTabStub";
import { ContextSidebar as ContextSidebarLegacy } from "./layout/ContextSidebar.legacy";
import { MainPanel } from "./layout/MainPanel.legacy";
import { PidAppShell } from "./layout/PidAppShell";
import { PidBody } from "./layout/PidBody";
import { PidFooter } from "./layout/PidFooter";
import { PidLeftRail } from "./layout/PidLeftRail";
import { PidRightPane } from "./layout/PidRightPane";
import { PidTopBar } from "./layout/PidTopBar";
import { installPideckDevHatch } from "./lib/dev/__pideck";
import { ThemeProvider } from "./theme/ThemeProvider";

export function App() {
  const initialize = useSessionsStore((s) => s.initialize);

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
              left={<PidLeftRail sessions={<SessionsList />} files={<FilesTabStub />} />}
              center={<MainPanel />}
              right={<PidRightPane git={<GitTabStub />} context={<ContextSidebarLegacy />} />}
            />
          }
          bottom={<PidFooter />}
        />
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
