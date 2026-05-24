import { useEffect } from "react";
import { PidChip } from "../../components/chip/PidChip";
import { Glyph } from "../../components/glyph";
import { useNavStore, useRailExpanded } from "../../lib/useNavStore";
import { PidNewSessionButton } from "./PidNewSessionButton";
import { PidProjectSwitcher } from "./PidProjectSwitcher";
import { PidSessionRow } from "./PidSessionRow";
import { useProjectsStore } from "./useProjectsStore";
import { useSessionsStore } from "./useSessionsStore";

const ARCHIVE_KEY = "__archive__";

export function PidSessionsList() {
  // Load the cross-project archived list once so the ARCHIVE group can render its count
  // without waiting for individual project blocks to expand.
  useEffect(() => {
    const { archivedLoaded, loadArchivedSessions, client } = useSessionsStore.getState();
    if (!archivedLoaded && client) void loadArchivedSessions();
  }, []);

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
        <ArchiveBlock />
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

  // Archived sessions live in the synthetic ARCHIVE group at the bottom; filter them out
  // of their original project so the same row doesn't render twice.
  const visible = sessions?.filter((s) => !s.archived);

  return (
    <div className="pid-rail-project">
      <PidProjectSwitcher project={project} count={visible?.length} />
      {expanded && visible
        ? visible.map((session) => (
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

function ArchiveBlock() {
  const archived = useSessionsStore((s) => s.archivedSessions);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const expanded = useNavStore((s) => s.expandedProjectsRail[ARCHIVE_KEY] ?? false);
  const toggle = () => useNavStore.getState().toggleRailProject(ARCHIVE_KEY);

  if (archived.length === 0) return null;

  return (
    <div className="pid-rail-project">
      <button
        type="button"
        className="pid-rail-project-header"
        aria-expanded={expanded}
        onClick={toggle}
      >
        <Glyph kind={expanded ? "chevron-down" : "chevron-right"} size={12} />
        <span className="pid-rail-project-name">archive</span>
        <PidChip>{String(archived.length)}</PidChip>
      </button>
      {expanded
        ? archived.map((session) => (
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
