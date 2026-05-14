import { Plus } from "../../components/icons/index.js";
import { IconButton } from "../../components/ui/IconButton.js";
import { useProjectsStore } from "./useProjectsStore.js";
import { useSessionsStore } from "./useSessionsStore.js";

export function NewSessionButton() {
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const createSession = useSessionsStore((s) => s.createSession);

  return (
    <IconButton
      label={activeProjectId ? "New session" : "Open a project first"}
      disabled={!activeProjectId}
      onClick={() => {
        if (activeProjectId) {
          // Errors surface via the store's toast push; swallow the rejection so it doesn't
          // bubble to an unhandled promise.
          createSession(activeProjectId).catch(() => {});
        }
      }}
    >
      <Plus size={16} />
    </IconButton>
  );
}
