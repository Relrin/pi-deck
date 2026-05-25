import type { SessionSummary } from "@pi-deck/core/domain/session.js";
import { useEffect, useMemo, useState } from "react";
import { useNavStore, useRailExpanded } from "../../lib/useNavStore";
import { PidNewSessionButton } from "./PidNewSessionButton";
import { PidProjectSwitcher } from "./PidProjectSwitcher";
import { PidSessionRow } from "./PidSessionRow";
import { RailFilterBar } from "./RailFilterBar";
import { useProjectsStore } from "./useProjectsStore";
import { useSessionsFilterStore } from "./useSessionsFilterStore";
import { useSessionsStore } from "./useSessionsStore";

const ARCHIVE_KEY = "__archive__";

// How many rows a project / archive block renders before collapsing the tail behind an
// "N MORE" toggle.
const RAIL_VISIBLE_CAP = 5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function sortSessions(
  sessions: SessionSummary[],
  dimension: "recent" | "created" | "branch" | "status",
): SessionSummary[] {
  const cmpStr = (a: string | undefined, b: string | undefined): number => {
    if (a === b) return 0;
    if (a === undefined) return 1;
    if (b === undefined) return -1;
    return a < b ? -1 : 1;
  };
  const cmpRecency = (a: SessionSummary, b: SessionSummary): number => {
    if (a.lastActivityAt === b.lastActivityAt) return 0;
    return a.lastActivityAt < b.lastActivityAt ? 1 : -1;
  };
  const next = [...sessions];
  switch (dimension) {
    case "recent":
      next.sort(cmpRecency);
      break;
    case "created":
      // Fall back to lastActivityAt when older persisted sessions lack a createdAt stamp.
      next.sort((a, b) => {
        const aKey = a.createdAt ?? a.lastActivityAt;
        const bKey = b.createdAt ?? b.lastActivityAt;
        if (aKey === bKey) return 0;
        return aKey < bKey ? 1 : -1;
      });
      break;
    case "branch":
      // Branchless sessions sink to the bottom; ties resolve by recency.
      next.sort((a, b) => cmpStr(a.branch, b.branch) || cmpRecency(a, b));
      break;
    case "status":
      // No real status field yet — keep recency until the backend exposes one.
      next.sort(cmpRecency);
      break;
  }
  return next;
}

/** Return only sessions whose lastActivityAt is within `since` of now. `all` short-circuits. */
function applySinceFilter(sessions: SessionSummary[], since: string): SessionSummary[] {
  if (since === "all") return sessions;
  const days = Number.parseInt(since, 10);
  if (!Number.isFinite(days)) return sessions;
  const cutoff = Date.now() - days * MS_PER_DAY;
  return sessions.filter((s) => Date.parse(s.lastActivityAt) >= cutoff);
}

/** Plain-substring search over a row's title and branch line. Empty query short-circuits. */
function applySearchFilter(sessions: SessionSummary[], query: string): SessionSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return sessions;
  return sessions.filter((s) => {
    if (s.title.toLowerCase().includes(q)) return true;
    if (s.branch?.toLowerCase().includes(q)) return true;
    return false;
  });
}

export function PidSessionsList() {
  const [query, setQuery] = useState("");
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
        <RailFilterBar query={query} onQueryChange={setQuery} />
      </div>
      <div className="pid-rail-sessions-body">
        <SessionsBody query={query} />
        <ArchiveBlock query={query} />
      </div>
    </div>
  );
}

/**
 * Top-level switcher that picks between the workspace-grouped layout (project headers +
 * per-project session rows) and the flat layout (one continuous list, no headers) based on
 * the user's `group` filter choice. Archive remains its own collapsible bucket in both
 * modes since archival is an explicit lifecycle action, not a grouping criterion.
 */
function SessionsBody({ query }: { query: string }) {
  const group = useSessionsFilterStore((s) => s.group);
  if (group === "flat") return <FlatListing query={query} />;
  return <ProjectsListing query={query} />;
}

function ProjectsListing({ query }: { query: string }) {
  const projects = useProjectsStore((s) => s.projects);
  const projectSelection = useSessionsFilterStore((s) => s.project);
  // Project filter hides whole project blocks. `kind: "all"` is the default and the most
  // common case, so we keep the original list ref to avoid an unnecessary copy.
  const visibleProjects =
    projectSelection.kind === "all"
      ? projects
      : projects.filter((p) => projectSelection.ids.includes(p.id));

  if (visibleProjects.length === 0) {
    return (
      <div className="pid-overview-empty" style={{ padding: "12px 14px" }}>
        {projects.length === 0 ? "no projects" : "no projects match the filter"}
      </div>
    );
  }
  return (
    <>
      {visibleProjects.map((project) => (
        <ProjectBlock key={project.id} projectId={project.id} query={query} />
      ))}
    </>
  );
}

/**
 * Renders every visible project's sessions in a single flat list — no per-project header,
 * no expand/collapse. Applies the same since/search/sort filters as the workspace layout.
 *
 * The grouped layout loads each project's sessions lazily on expand; flat mode has nowhere
 * to "expand" so we eagerly trigger `loadProjectSessions` for any visible project we
 * haven't fetched yet. The store dedups in-flight fetches.
 */
function FlatListing({ query }: { query: string }) {
  const projects = useProjectsStore((s) => s.projects);
  const projectSelection = useSessionsFilterStore((s) => s.project);
  const sessionsByProject = useSessionsStore((s) => s.sessionsByProject);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const sort = useSessionsFilterStore((s) => s.sort);
  const since = useSessionsFilterStore((s) => s.since);

  // Memoised so the effect below sees a stable reference (and only fires when the visible
  // project set actually changes), instead of every render where map() produces a new array.
  const visibleProjectIds = useMemo(
    () =>
      projectSelection.kind === "all"
        ? projects.map((p) => p.id)
        : projects.filter((p) => projectSelection.ids.includes(p.id)).map((p) => p.id),
    [projects, projectSelection],
  );

  useEffect(() => {
    const store = useSessionsStore.getState();
    for (const id of visibleProjectIds) {
      if (store.sessionsByProject[id] !== undefined) continue;
      if (store.loadingByProject[id]) continue;
      void store.loadProjectSessions(id).catch(() => {});
    }
  }, [visibleProjectIds]);

  if (visibleProjectIds.length === 0) {
    return (
      <div className="pid-overview-empty" style={{ padding: "12px 14px" }}>
        {projects.length === 0 ? "no projects" : "no projects match the filter"}
      </div>
    );
  }

  let combined: SessionSummary[] = [];
  for (const id of visibleProjectIds) {
    const list = sessionsByProject[id];
    if (list) combined = combined.concat(list.filter((s) => !s.archived));
  }
  combined = applySinceFilter(combined, since);
  combined = applySearchFilter(combined, query);
  combined = sortSessions(combined, sort);

  if (combined.length === 0) return null;

  return <RailRowList sessions={combined} activeSessionId={activeSessionId} />;
}

interface ProjectBlockProps {
  projectId: string;
  query: string;
}

function ProjectBlock({ projectId, query }: ProjectBlockProps) {
  const project = useProjectsStore((s) => s.projects.find((p) => p.id === projectId));
  const expanded = useRailExpanded(projectId);
  const sessions = useSessionsStore((s) => s.sessionsByProject[projectId]);
  const loading = useSessionsStore((s) => s.loadingByProject[projectId] ?? false);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const sort = useSessionsFilterStore((s) => s.sort);
  const since = useSessionsFilterStore((s) => s.since);

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
  // of their original project so the same row doesn't render twice. Then apply the user's
  // since cut-off, then the search query, then sort.
  let visible: SessionSummary[] | undefined;
  if (sessions) {
    visible = sessions.filter((s) => !s.archived);
    visible = applySinceFilter(visible, since);
    visible = applySearchFilter(visible, query);
    visible = sortSessions(visible, sort);
  }

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

function ArchiveBlock({ query }: { query: string }) {
  const archived = useSessionsStore((s) => s.archivedSessions);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const expanded = useNavStore((s) => s.expandedProjectsRail[ARCHIVE_KEY] ?? false);
  const toggle = () => useNavStore.getState().toggleRailProject(ARCHIVE_KEY);
  const sort = useSessionsFilterStore((s) => s.sort);
  const since = useSessionsFilterStore((s) => s.since);

  if (archived.length === 0) return null;

  let sortedArchived = applySinceFilter(archived, since);
  sortedArchived = applySearchFilter(sortedArchived, query);
  sortedArchived = sortSessions(sortedArchived, sort);
  if (sortedArchived.length === 0) return null;

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
        <span className="pid-rail-project-count">{sortedArchived.length}</span>
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
      {expanded ? (
        <RailRowList sessions={sortedArchived} activeSessionId={activeSessionId} />
      ) : null}
    </div>
  );
}
