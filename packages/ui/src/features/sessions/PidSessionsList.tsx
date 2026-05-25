import type { SessionSummary } from "@pi-deck/core/domain/session.js";
import { useEffect, useState } from "react";
import { Glyph } from "../../components/glyph";
import { useNavStore, useRailExpanded } from "../../lib/useNavStore";
import { PidNewSessionButton } from "./PidNewSessionButton";
import { PidProjectSwitcher } from "./PidProjectSwitcher";
import { PidSessionRow } from "./PidSessionRow";
import { useProjectsStore } from "./useProjectsStore";
import { useSessionsStore } from "./useSessionsStore";

const ARCHIVE_KEY = "__archive__";

// How many rows a project / archive block renders before collapsing the tail behind an
// "N MORE" toggle.
const RAIL_VISIBLE_CAP = 5;

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
        <PidNewSessionButton />
      </div>
      <div className="pid-rail-sessions-actions">
        <span className="pid-rail-sessions-filter">
          <Glyph kind="search" size={12} />
          <span>filter sessions…</span>
        </span>
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
      {expanded && visible ? (
        <RailRowList sessions={visible} activeSessionId={activeSessionId} />
      ) : null}
    </div>
  );
}

interface RailRowListProps {
  sessions: SessionSummary[];
  activeSessionId: string | undefined;
}

/**
 * Renders up to `RAIL_VISIBLE_CAP` session rows, with an "N MORE" / "SHOW LESS" toggle row
 * underneath when the list overflows. The toggle keeps the currently-active session visible
 * even when collapsed — otherwise opening a session that lives past the cap would make its
 * own row disappear from the rail.
 */
function RailRowList({ sessions, activeSessionId }: RailRowListProps) {
  const [showAll, setShowAll] = useState(false);
  const overflow = sessions.length - RAIL_VISIBLE_CAP;

  let visible: SessionSummary[];
  if (showAll || overflow <= 0) {
    visible = sessions;
  } else {
    const head = sessions.slice(0, RAIL_VISIBLE_CAP);
    // If the active session is hidden in the collapsed tail, expand it into the visible
    // slice so users can always see the row they're currently in.
    const activeInTail =
      activeSessionId && sessions.slice(RAIL_VISIBLE_CAP).find((s) => s.id === activeSessionId);
    visible = activeInTail ? [...head, activeInTail] : head;
  }

  return (
    <>
      {visible.map((session) => (
        <PidSessionRow key={session.id} session={session} active={session.id === activeSessionId} />
      ))}
      {overflow > 0 ? (
        <button
          type="button"
          className="pid-rail-overflow"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
        >
          <span className="pid-rail-overflow-rule" />
          <span className="pid-rail-overflow-label">
            {showAll ? "show less" : `${overflow} more`}
          </span>
          <span className="pid-rail-overflow-rule" />
        </button>
      ) : null}
    </>
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
        <span className="pid-rail-project-sq" aria-hidden />
        <span className="pid-rail-project-name">archive</span>
        <span className="pid-rail-project-count">{archived.length}</span>
        <span className="pid-rail-project-caret" aria-hidden>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden focusable="false">
            <title>{expanded ? "Expanded" : "Collapsed"}</title>
            {expanded ? (
              <path d="M 1.5 3 L 8.5 3 L 5 7.5 Z" fill="currentColor" />
            ) : (
              <path d="M 7 1.5 L 7 8.5 L 2.5 5 Z" fill="currentColor" />
            )}
          </svg>
        </span>
      </button>
      {expanded ? <RailRowList sessions={archived} activeSessionId={activeSessionId} /> : null}
    </div>
  );
}
