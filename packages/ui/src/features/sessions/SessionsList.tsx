import { useEffect, useMemo } from "react";
import { EmptyState } from "../../components/EmptyState.js";
import { Filter, Folder, Plus, Search } from "../../components/icons/index.js";
import { Spinner } from "../../components/ui/Spinner.js";
import { Tooltip } from "../../components/ui/Tooltip.js";
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
      <header className="flex h-10 items-center gap-2 border-b border-[var(--color-border)] px-3">
        <h2 className="flex-1 text-sm font-medium text-[var(--color-text)]">Sessions</h2>
        {isRefreshing && (
          <Spinner
            size={12}
            className="text-[var(--color-text-subtle)]"
            aria-label="Refreshing sessions"
          />
        )}
        <NewSessionButton />
        <div className="inline-flex items-stretch overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-panel-2)]">
          <Tooltip content="Filter sessions" side="bottom">
            {/* TODO: wire filter dropdown — visual-only for this iteration. */}
            <button
              type="button"
              aria-label="Filter sessions"
              onClick={() => {}}
              className="inline-flex h-6 w-7 items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-panel-hover)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <Filter size={13} />
            </button>
          </Tooltip>
          <Tooltip content="Search sessions" side="bottom">
            {/* TODO: wire search input — visual-only for this iteration. */}
            <button
              type="button"
              aria-label="Search sessions"
              onClick={() => {}}
              className="inline-flex h-6 w-7 items-center justify-center border-l border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:bg-[var(--color-panel-hover)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <Search size={13} />
            </button>
          </Tooltip>
        </div>
      </header>
      <div className="border-b border-[var(--color-border)] px-3 py-2">
        <ProjectSwitcher />
      </div>
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
