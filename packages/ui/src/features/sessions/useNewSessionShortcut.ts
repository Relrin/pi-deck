import { useEffect } from "react";
import { useNavStore } from "../../lib/useNavStore";
import { useProjectsStore } from "./useProjectsStore";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Global Cmd/Ctrl+N hotkey: routes the user to the blank/composer screen so they can start
 * a new session from there (the session itself is created on first prompt submit). No-op
 * when no project is active.
 *
 * Suppressed while focus is inside an editable element so the user can type the letter
 * "n" without triggering the shortcut.
 */
export function useNewSessionShortcut(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "n" || event.repeat) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.shiftKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      const activeProjectId = useProjectsStore.getState().activeProjectId;
      if (!activeProjectId) return;
      event.preventDefault();
      useNavStore.getState().goToBlank();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
