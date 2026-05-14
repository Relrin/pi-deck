import { Plus } from "../../components/icons/index.js";
import { IconButton } from "../../components/ui/IconButton.js";
import { useProjectsStore } from "./useProjectsStore.js";
import { useSessionsStore } from "./useSessionsStore.js";

export function NewSessionButton() {
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const createSession = useSessionsStore((s) => s.createSession);

  return (
    <IconButton
      label="New session"
      disabled={!activeProjectId}
      onClick={() => {
        if (activeProjectId) createSession(activeProjectId).catch(() => {});
      }}
    >
      <Plus size={16} />
    </IconButton>
  );
}
