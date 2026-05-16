import type { ProjectSummary } from "@pi-deck/core/domain/project.js";
import { useEffect } from "react";
import { PidChip } from "../../../components/chip/PidChip";
import { Glyph } from "../../../components/glyph";
import { useNavStore, useOverviewExpanded } from "../../../lib/useNavStore";
import { useSessionsStore } from "../useSessionsStore";
import { PidSessionCard } from "./PidSessionCard";

export interface ProjectSectionProps {
  project: ProjectSummary;
}

export function ProjectSection({ project }: ProjectSectionProps) {
  const expanded = useOverviewExpanded(project.id);
  const sessions = useSessionsStore((s) => s.sessionsByProject[project.id]);
  const loading = useSessionsStore((s) => s.loadingByProject[project.id] ?? false);
  const error = useSessionsStore((s) => s.errorByProject[project.id]);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);

  // First-expand fetch: trigger a load if expanded, nothing cached yet, and not in flight.
  useEffect(() => {
    if (!expanded) return;
    if (sessions !== undefined) return;
    if (loading) return;
    useSessionsStore
      .getState()
      .loadProjectSessions(project.id)
      .catch(() => {});
  }, [expanded, sessions, loading, project.id]);

  const count = sessions?.length ?? 0;

  return (
    <section className="pid-overview-section" data-project-id={project.id}>
      <header className="pid-overview-header">
        <button
          type="button"
          className="pid-overview-header-button"
          aria-expanded={expanded}
          onClick={() => useNavStore.getState().toggleOverviewProject(project.id)}
        >
          <Glyph kind={expanded ? "chevron-down" : "chevron-right"} size={12} />
          <span className="pid-overview-header-title">{project.displayName}</span>
        </button>
        {sessions !== undefined ? <PidChip>{String(count)}</PidChip> : null}
        <div className="pid-overview-header-actions">
          {loading ? <span className="pid-overview-empty">loading…</span> : null}
        </div>
      </header>
      {expanded ? (
        <>
          {error ? (
            <div className="pid-overview-error" role="alert">
              <span>{error}</span>
              <button
                type="button"
                className="pid-btn"
                data-variant="ghost"
                onClick={() => {
                  useSessionsStore
                    .getState()
                    .loadProjectSessions(project.id)
                    .catch(() => {});
                }}
              >
                Retry
              </button>
            </div>
          ) : null}
          {sessions && sessions.length > 0 ? (
            <div className="pid-overview-grid">
              {sessions.map((session) => (
                <PidSessionCard
                  key={session.id}
                  session={session}
                  active={session.id === activeSessionId}
                />
              ))}
            </div>
          ) : null}
          {sessions && sessions.length === 0 && !loading && !error ? (
            <div className="pid-overview-empty">no sessions yet</div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
