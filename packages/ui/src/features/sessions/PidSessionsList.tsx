import { useEffect } from "react";
import { Glyph } from "../../components/glyph";
import { useRailExpanded } from "../../lib/useNavStore";
import { PidNewSessionButton } from "./PidNewSessionButton";
import { PidProjectSwitcher } from "./PidProjectSwitcher";
import { PidSessionRow } from "./PidSessionRow";
import { useProjectsStore } from "./useProjectsStore";
import { useSessionsStore } from "./useSessionsStore";

export function PidSessionsList() {
  return (
    <div className="pid-rail-sessions">
      <div className="pid-rail-sessions-actions">
        <span className="pid-rail-sessions-filter">
          <Glyph kind="search" size={12} />
          <span>filter sessions…</span>
        </span>
      </div>
      <div className="pid-rail-sessions-actions">
        <PidNewSessionButton />
      </div>
      <div className="pid-rail-sessions-body">
        <ProjectsListing />
      </div>
    </div>
  );
}

function ProjectsListing() {
  const projects = useProjectsStore((s) => s.projects);
  if (projects.length === 0) {
    return (
      <div className="pid-overview-empty" style={{ padding: "12px 14px" }}>
        no projects
      </div>
    );
  }
  return (
    <>
      {projects.map((project) => (
        <ProjectBlock key={project.id} projectId={project.id} />
      ))}
    </>
  );
}

interface ProjectBlockProps {
  projectId: string;
}

function ProjectBlock({ projectId }: ProjectBlockProps) {
  const project = useProjectsStore((s) => s.projects.find((p) => p.id === projectId));
  const expanded = useRailExpanded(projectId);
  const sessions = useSessionsStore((s) => s.sessionsByProject[projectId]);
  const loading = useSessionsStore((s) => s.loadingByProject[projectId] ?? false);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);

  useEffect(() => {
    if (!expanded) return;
    if (sessions !== undefined) return;
    if (loading) return;
    useSessionsStore
      .getState()
      .loadProjectSessions(projectId)
      .catch(() => {});
  }, [expanded, sessions, loading, projectId]);

  if (!project) return null;

  return (
    <div className="pid-rail-project">
      <PidProjectSwitcher project={project} count={sessions?.length} />
      {expanded && sessions
        ? sessions.map((session) => (
            <PidSessionRow
              key={session.id}
              session={session}
              active={session.id === activeSessionId}
            />
          ))
        : null}
    </div>
  );
}
