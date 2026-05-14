import { useEffect, useMemo } from "react";
import { EmptyState } from "../../components/EmptyState.js";
import { Folder, Plus } from "../../components/icons/index.js";
import { Spinner } from "../../components/ui/Spinner.js";
import { NewSessionButton } from "./NewSessionButton.js";
import { ProjectSwitcher } from "./ProjectSwitcher.js";
import { SessionRow } from "./SessionRow.js";
import { useProjectsStore } from "./useProjectsStore.js";
import { useSessionsStore } from "./useSessionsStore.js";

export function SessionsList() {
  const client = useSessionsStore((s) => s.client);
  const sessions = useSessionsStore((s) => s.sessions);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const isRefreshing = useSessionsStore((s) => s.isRefreshing);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);

  // refresh sessions when the project changes. We pull `refreshSessions` lazily inside the
  // effect so its function identity doesn't trigger re-fetches.
  useEffect(() => {
    if (!client || !activeProjectId) return;
    void useSessionsStore.getState().refreshSessions(activeProjectId);
  }, [client, activeProjectId]);

  const ordered = useMemo(() => {
    return [...sessions].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  }, [sessions]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center gap-1 border-b border-[var(--color-border)] px-2 py-2">
        <div className="min-w-0 flex-1">
          <ProjectSwitcher />
        </div>
        {isRefreshing && (
          <Spinner
            size={12}
            className="text-[var(--color-text-subtle)]"
            aria-label="Refreshing sessions"
          />
        )}
        <NewSessionButton />
      </header>
      <div className="flex-1 overflow-y-auto" aria-busy={isRefreshing || undefined}>
        {!activeProjectId && (
          <EmptyState
            compact
            icon={<Folder size={20} />}
            title="No project open"
            description="Open a folder to see its sessions."
          />
        )}
        {activeProjectId && ordered.length === 0 && !isRefreshing && (
          <EmptyState
            compact
            icon={<Plus size={20} />}
            title="No sessions yet"
            description="Use + above to start one."
          />
        )}
        {ordered.map((session) => (
          <SessionRow key={session.id} session={session} active={session.id === activeSessionId} />
        ))}
      </div>
    </div>
  );
}
