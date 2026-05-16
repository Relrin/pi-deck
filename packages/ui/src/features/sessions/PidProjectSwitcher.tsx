import type { ProjectSummary } from "@pi-deck/core/domain/project.js";
import { PidChip } from "../../components/chip/PidChip";
import { Glyph } from "../../components/glyph";
import { useNavStore, useRailExpanded } from "../../lib/useNavStore";

export interface PidProjectSwitcherProps {
  project: ProjectSummary;
  count: number | undefined;
}

export function PidProjectSwitcher({ project, count }: PidProjectSwitcherProps) {
  const expanded = useRailExpanded(project.id);

  return (
    <button
      type="button"
      className="pid-rail-project-header"
      aria-expanded={expanded}
      onClick={() => useNavStore.getState().toggleRailProject(project.id)}
    >
      <Glyph kind={expanded ? "chevron-down" : "chevron-right"} size={12} />
      <span className="pid-rail-project-name">{project.displayName}</span>
      {count !== undefined ? <PidChip>{String(count)}</PidChip> : null}
    </button>
  );
}
