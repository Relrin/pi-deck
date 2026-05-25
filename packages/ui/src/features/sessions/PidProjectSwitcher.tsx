import type { ProjectSummary } from "@pi-deck/core/domain/project.js";
import { useNavStore, useRailExpanded } from "../../lib/useNavStore";
import { useSessionsStore } from "./useSessionsStore";

export interface PidProjectSwitcherProps {
  project: ProjectSummary;
  count: number | undefined;
}

export function PidProjectSwitcher({ project, count }: PidProjectSwitcherProps) {
  const expanded = useRailExpanded(project.id);
  const hostingActive = useSessionsStore((s) => {
    if (!s.activeSessionId) return false;
    const list = s.sessionsByProject[project.id];
    return list ? list.some((x) => x.id === s.activeSessionId) : false;
  });

  return (
    <button
      type="button"
      className="pid-rail-project-header"
      aria-expanded={expanded}
      data-active={hostingActive ? "true" : undefined}
      onClick={() => useNavStore.getState().toggleRailProject(project.id)}
    >
      <span className="pid-rail-project-sq" aria-hidden />
      <span className="pid-rail-project-name">{project.displayName}</span>
      {count !== undefined ? <span className="pid-rail-project-count">{count}</span> : null}
      <span className="pid-rail-project-caret" aria-hidden>
        <ProjectCaret expanded={expanded} />
      </span>
    </button>
  );
}

function ProjectCaret({ expanded }: { expanded: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden focusable="false">
      <title>{expanded ? "Expanded" : "Collapsed"}</title>
      {expanded ? (
        // Down-pointing triangle, centred vertically in the 10x10 box (apex at y=7.5).
        <path d="M 1.5 3 L 8.5 3 L 5 7.5 Z" fill="currentColor" />
      ) : (
        // Left-pointing triangle, centred horizontally (apex at x=2.5).
        <path d="M 7 1.5 L 7 8.5 L 2.5 5 Z" fill="currentColor" />
      )}
    </svg>
  );
}
