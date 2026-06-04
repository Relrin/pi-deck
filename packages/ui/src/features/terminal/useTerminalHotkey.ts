import { useEffect } from "react";
import { useTerminalStore } from "./useTerminalStore.js";

/**
 * Global Ctrl/Cmd+` hotkey to toggle the bottom terminal panel (VS Code's binding). Mounted
 * once near the top of the React tree (see App.tsx).
 */
export function useTerminalHotkey(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "`" || event.repeat) return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      event.preventDefault();
      useTerminalStore.getState().togglePanel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
