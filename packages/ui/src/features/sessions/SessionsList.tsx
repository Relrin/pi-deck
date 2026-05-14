import { useEffect, useMemo } from "react";
import { NewSessionButton } from "./NewSessionButton.js";
import { ProjectSwitcher } from "./ProjectSwitcher.js";
import { SessionRow } from "./SessionRow.js";
import { useProjectsStore } from "./useProjectsStore.js";
import { useSessionsStore } from "./useSessionsStore.js";

export function SessionsList() {
  const client = useSessionsStore((s) => s.client);
  const sessions = useSessionsStore((s) => s.sessions);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const refreshSessions = useSessionsStore((s) => s.refreshSessions);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);

  useEffect(() => {
    if (client && activeProjectId) {
      refreshSessions(activeProjectId).catch(() => {});
    }
  }, [client, activeProjectId, refreshSessions]);

  const ordered = useMemo(() => {
    return [...sessions].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  }, [sessions]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center gap-1 border-b border-[var(--color-border)] px-2 py-2">
        <div className="min-w-0 flex-1">
          <ProjectSwitcher />
        </div>
        <NewSessionButton />
      </header>
      <div className="flex-1 overflow-y-auto">
        {!activeProjectId && (
          <div className="grid h-full place-items-center px-5 py-6 text-center text-sm text-[var(--color-text-subtle)]">
            Open a folder to see its sessions.
          </div>
        )}
        {activeProjectId && ordered.length === 0 && (
          <div className="grid h-full place-items-center px-5 py-6 text-center text-sm text-[var(--color-text-subtle)]">
            No sessions yet — use + to create one.
          </div>
        )}
        {ordered.map((session) => (
          <SessionRow key={session.id} session={session} active={session.id === activeSessionId} />
        ))}
      </div>
    </div>
  );
}
