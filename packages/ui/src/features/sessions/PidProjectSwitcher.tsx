import type { ProjectSummary } from "@pi-deck/core/domain/project.js";
import { ChevronDown, ChevronRight } from "../../components/icons/index.js";
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
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
      </span>
    </button>
  );
}
