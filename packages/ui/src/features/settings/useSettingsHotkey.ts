import { useEffect } from "react";
import { useSettingsStore } from "./useSettingsStore";

/**
 * Global Cmd/Ctrl+, hotkey toggle for the settings overlay.
 * Mounted once near the top of the React tree (see App.tsx).
 */
export function useSettingsHotkey(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "," || event.repeat) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      // Let inputs that legitimately want "," pass through — Cmd/Ctrl+, isn't a typing shortcut.
      event.preventDefault();
      useSettingsStore.getState().toggle();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
