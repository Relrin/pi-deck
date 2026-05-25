import { type ReactNode, useMemo, useState } from "react";
import { Glyph } from "../../components/glyph";
import { useProjectsStore } from "./useProjectsStore";
import {
  ALL_STATUSES,
  dirtyCount,
  isSectionDirty,
  type ProjectSelection,
  type SessionStatus,
  type SessionsGroup,
  type SessionsSince,
  type SessionsSort,
  useSessionsFilterStore,
} from "./useSessionsFilterStore";

const STATUS_OPTIONS: { id: SessionStatus; label: string; toneVar: string }[] = [
  { id: "running", label: "running", toneVar: "var(--add)" },
  { id: "review", label: "review", toneVar: "var(--mod)" },
  { id: "merged", label: "merged", toneVar: "var(--info)" },
  { id: "idle", label: "idle", toneVar: "var(--ink-3)" },
];

const SINCE_OPTIONS: { id: SessionsSince; label: string }[] = [
  { id: "1d", label: "1d" },
  { id: "7d", label: "7d" },
  { id: "14d", label: "14d" },
  { id: "30d", label: "30d" },
  { id: "all", label: "all" },
];

const SORT_OPTIONS: { id: SessionsSort; label: string }[] = [
  { id: "recent", label: "recent" },
  { id: "created", label: "created" },
  { id: "branch", label: "branch" },
  { id: "status", label: "status" },
];

const GROUP_OPTIONS: { id: SessionsGroup; label: string }[] = [
  { id: "workspace", label: "workspace" },
  { id: "branch", label: "branch" },
  { id: "status", label: "status" },
  { id: "flat", label: "flat" },
];

/**
 * "Sort, group & filter sessions" popover.
 *
 * Layout mirrors the mockup: a stacked list of accordion rows, each row shows its label,
 * a summary of the current selection, and a chevron. Expanding reveals checkboxes (multi)
 * or radios (single). Footer renders "defaults" / "N active" alongside reset + done.
 *
 * Trigger and popover are siblings inside a relative wrapper rendered by `RailFilterBar`
 * so the click-outside dismissal can compare against the same DOM subtree.
 */
export function SessionsFilterPopover({ onClose }: { onClose: () => void }) {
  const state = useSessionsFilterStore();
  const dirty = dirtyCount(state);
  const projects = useProjectsStore((s) => s.projects);
  const allProjectIds = useMemo(() => projects.map((p) => p.id), [projects]);

  // Track which sections are open. Mockup default: everything collapsed.
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const toggleSection = (id: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="pid-sessions-filter-pop" role="dialog" aria-label="Filter sessions">
      <div className="pid-sessions-filter-list">
        <AccordionSection
          id="status"
          label="status"
          summary={summariseStatus(state.status)}
          dirty={isSectionDirty(state, "status")}
          open={openSections.has("status")}
          onToggle={() => toggleSection("status")}
        >
          {STATUS_OPTIONS.map((o) => (
            <FilterCheckbox
              key={o.id}
              label={o.label}
              tone={o.toneVar}
              checked={state.status.includes(o.id)}
              onChange={() => useSessionsFilterStore.getState().toggleStatus(o.id)}
            />
          ))}
        </AccordionSection>

        <AccordionSection
          id="project"
          label="project"
          summary={summariseProject(state.project, allProjectIds.length)}
          dirty={isSectionDirty(state, "project")}
          open={openSections.has("project")}
          onToggle={() => toggleSection("project")}
        >
          <ProjectPicker />
        </AccordionSection>

        <AccordionSection
          id="since"
          label="since"
          summary={state.since}
          dirty={isSectionDirty(state, "since")}
          open={openSections.has("since")}
          onToggle={() => toggleSection("since")}
        >
          {SINCE_OPTIONS.map((o) => (
            <FilterRadio
              key={o.id}
              label={o.label}
              checked={state.since === o.id}
              onChange={() => useSessionsFilterStore.getState().setSince(o.id)}
            />
          ))}
        </AccordionSection>

        <div className="pid-sessions-filter-divider" />

        <AccordionSection
          id="sort"
          label="sort"
          summary={state.sort}
          dirty={isSectionDirty(state, "sort")}
          open={openSections.has("sort")}
          onToggle={() => toggleSection("sort")}
        >
          {SORT_OPTIONS.map((o) => (
            <FilterRadio
              key={o.id}
              label={o.label}
              checked={state.sort === o.id}
              onChange={() => useSessionsFilterStore.getState().setSort(o.id)}
            />
          ))}
        </AccordionSection>

        <AccordionSection
          id="group"
          label="group"
          summary={state.group}
          dirty={isSectionDirty(state, "group")}
          open={openSections.has("group")}
          onToggle={() => toggleSection("group")}
        >
          {GROUP_OPTIONS.map((o) => (
            <FilterRadio
              key={o.id}
              label={o.label}
              checked={state.group === o.id}
              onChange={() => useSessionsFilterStore.getState().setGroup(o.id)}
            />
          ))}
        </AccordionSection>
      </div>

      <div className="pid-sessions-filter-footer">
        <span className="pid-sessions-filter-footer-status">
          {dirty === 0 ? "defaults" : `${dirty} active`}
        </span>
        <button
          type="button"
          className="pid-sessions-filter-footer-reset"
          disabled={dirty === 0}
          onClick={() => useSessionsFilterStore.getState().reset()}
        >
          reset
        </button>
        <button type="button" className="pid-sessions-filter-footer-done" onClick={onClose}>
          done
        </button>
      </div>
    </div>
  );
}

interface AccordionSectionProps {
  id: string;
  label: string;
  summary: string;
  dirty: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function AccordionSection({
  id,
  label,
  summary,
  dirty,
  open,
  onToggle,
  children,
}: AccordionSectionProps) {
  return (
    <div className="pid-sessions-filter-section" data-section={id} data-open={open || undefined}>
      <button
        type="button"
        className="pid-sessions-filter-section-header"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="pid-sessions-filter-section-label">{label}</span>
        <span
          className="pid-sessions-filter-section-summary"
          data-dirty={dirty ? "true" : undefined}
        >
          {summary}
        </span>
        {dirty ? <span className="pid-sessions-filter-section-dot" aria-hidden /> : null}
        <span className="pid-sessions-filter-section-caret" aria-hidden>
          <Glyph kind={open ? "chevron-down" : "chevron-right"} size={9} />
        </span>
      </button>
      {open ? <div className="pid-sessions-filter-section-body">{children}</div> : null}
    </div>
  );
}

interface FilterCheckboxProps {
  label: string;
  tone?: string;
  checked: boolean;
  onChange: () => void;
}

function FilterCheckbox({ label, tone, checked, onChange }: FilterCheckboxProps) {
  return (
    <button
      type="button"
      className="pid-sessions-filter-option"
      data-checked={checked || undefined}
      onClick={onChange}
    >
      <span className="pid-sessions-filter-option-check" data-checked={checked || undefined}>
        {checked ? <Glyph kind="check" size={8} /> : null}
      </span>
      <span className="pid-sessions-filter-option-label">
        {tone ? (
          <span className="pid-sessions-filter-option-tone" style={{ background: tone }} />
        ) : null}
        {label}
      </span>
    </button>
  );
}

interface FilterRadioProps {
  label: string;
  checked: boolean;
  onChange: () => void;
}

function FilterRadio({ label, checked, onChange }: FilterRadioProps) {
  return (
    <button
      type="button"
      className="pid-sessions-filter-option"
      data-checked={checked || undefined}
      onClick={onChange}
    >
      <span className="pid-sessions-filter-option-radio" data-checked={checked || undefined} />
      <span className="pid-sessions-filter-option-label">{label}</span>
    </button>
  );
}

/**
 * Project picker: a search input, an "All" tri-state toggle, then a scrollable list of
 * projects. The "All" toggle flips between selecting every project and clearing the list.
 */
function ProjectPicker() {
  const projects = useProjectsStore((s) => s.projects);
  const selection = useSessionsFilterStore((s) => s.project);
  const [q, setQ] = useState("");

  const allIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const selectedIds = useMemo(() => {
    if (selection.kind === "all") return new Set(allIds);
    return new Set(selection.ids);
  }, [selection, allIds]);
  const filtered = q
    ? projects.filter((p) => p.displayName.toLowerCase().includes(q.toLowerCase()))
    : projects;

  let allState: "all" | "none" | "some" = "all";
  if (selection.kind === "subset") {
    if (selection.ids.length === 0) allState = "none";
    else if (
      selection.ids.length === allIds.length &&
      allIds.every((id) => selection.ids.includes(id))
    ) {
      allState = "all";
    } else {
      allState = "some";
    }
  }

  return (
    <div className="pid-sessions-filter-project">
      <div className="pid-sessions-filter-project-search">
        <Glyph kind="search" size={10} />
        <input
          type="text"
          placeholder="filter project…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {q ? null : (
        <button
          type="button"
          className="pid-sessions-filter-option pid-sessions-filter-project-all"
          onClick={() => {
            if (allState === "all") useSessionsFilterStore.getState().setProjectNone();
            else useSessionsFilterStore.getState().setProjectAll(allIds);
          }}
        >
          <span
            className="pid-sessions-filter-option-check"
            data-checked={allState === "all" || undefined}
            data-mixed={allState === "some" || undefined}
          >
            {allState === "all" ? <Glyph kind="check" size={8} /> : null}
            {allState === "some" ? (
              <span className="pid-sessions-filter-option-check-dash" />
            ) : null}
          </span>
          <span className="pid-sessions-filter-option-label">All</span>
          <span className="pid-sessions-filter-option-count">
            {selectedIds.size} / {allIds.length}
          </span>
        </button>
      )}
      <div className="pid-sessions-filter-project-list">
        {filtered.length === 0 ? (
          <div className="pid-sessions-filter-empty">no matches</div>
        ) : (
          filtered.map((p) => (
            <FilterCheckbox
              key={p.id}
              label={p.displayName}
              checked={selectedIds.has(p.id)}
              onChange={() => useSessionsFilterStore.getState().toggleProject(p.id, allIds)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function summariseStatus(selected: SessionStatus[]): string {
  if (selected.length === ALL_STATUSES.length) return "all";
  if (selected.length === 0) return "none";
  const first = selected[0];
  if (selected.length === 1 && first) return first;
  return `${selected.length} selected`;
}

function summariseProject(selection: ProjectSelection, total: number): string {
  if (selection.kind === "all") return "all";
  if (selection.ids.length === 0) return "none";
  if (selection.ids.length === total) return "all";
  if (selection.ids.length === 1) return "1 selected";
  return `${selection.ids.length} selected`;
}
