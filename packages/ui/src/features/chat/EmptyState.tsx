import { useEffect } from "react";
import { EmptyState as Frame } from "../../components/EmptyState.js";
import { FolderOpen, Plus } from "../../components/icons/index.js";
import { Button } from "../../components/ui/Button.js";
import { useProjectsStore } from "../sessions/useProjectsStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";

export function EmptyState() {
  const client = useSessionsStore((s) => s.client);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const projects = useProjectsStore((s) => s.projects);
  const openFromDialog = useProjectsStore((s) => s.openProjectFromDialog);
  const createSession = useSessionsStore((s) => s.createSession);
  const refreshSessions = useSessionsStore((s) => s.refreshSessions);

  useEffect(() => {
    if (client && activeProjectId) {
      refreshSessions(activeProjectId).catch(() => {});
    }
  }, [client, activeProjectId, refreshSessions]);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <main className="flex h-full w-full items-center justify-center bg-[var(--color-bg)] text-[var(--color-text)]">
      {activeProject ? (
        <Frame
          icon={<Plus size={28} />}
          title="No session selected"
          description={activeProject.displayName}
          action={
            <Button
              variant="primary"
              onClick={() => activeProjectId && createSession(activeProjectId).catch(() => {})}
            >
              <Plus size={14} />
              New session
            </Button>
          }
        />
      ) : (
        <Frame
          icon={<FolderOpen size={28} />}
          title="No project open"
          description="Open a folder to get started."
          action={
            <Button
              variant="primary"
              onClick={() => {
                if (client) openFromDialog(client);
              }}
              disabled={!client}
            >
              <FolderOpen size={14} />
              Open folder…
            </Button>
          }
        />
      )}
    </main>
  );
}
