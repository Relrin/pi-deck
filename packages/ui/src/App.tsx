import { useEffect } from "react";
import { TooltipProvider } from "./components/ui/Tooltip";
import { Toaster } from "./features/_status/Toaster";
import { useSessionsStore } from "./features/sessions/useSessionsStore";
import { AppShell } from "./layout/AppShell";
import { ThemeProvider } from "./theme/ThemeProvider";

export function App() {
  const initialize = useSessionsStore((s) => s.initialize);

  useEffect(() => {
    initialize().catch((err) => {
      console.error("Failed to initialize session store:", err);
    });
  }, [initialize]);

  return (
    <ThemeProvider>
      <TooltipProvider>
        <AppShell />
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
