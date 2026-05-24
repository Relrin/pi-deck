import type { GitChange, GitHunk } from "@pi-deck/core/git/types.js";
import { type MouseEvent, useMemo, useState } from "react";
import { Folder } from "../../components/icons/index.js";
import { ChangeRow } from "./ChangeRow.js";
import { GroupModeMenu } from "./GroupModeMenu.js";
import { type GroupMode, useGroupModeStore } from "./useGroupModeStore.js";
import { useStagingStore } from "./useStagingStore.js";

interface Props {
  projectId: string;
  changes: GitChange[];
  totals: { add: number; del: number };
  touched: Set<string>;
  /** Per-file hunk lists from `git.diffHunks`. Undefined until the user has switched to
   * hunk grouping (the fetch is gated on `groupMode === "hunk"` in GitSidebar). */
  hunksByPath: Record<string, GitHunk[]> | undefined;
}

/**
 * Locale-aware natural-order collator: handles digit runs ("file2" < "file10"), folds case
 * ("README" interleaves with "readme"), and respects the user's UI locale via `undefined`.
 * One instance is shared by every `ChangesList` render — `Intl.Collator` is expensive to
 * construct, cheap to call.
 */
const PATH_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/**
 * Sort the change rows like GitHub's PR file list:
 *   1. tracked changes first, untracked (`?`) sink to the bottom — untracked rows are
 *      conceptually "pending decision" and clustering them avoids interleaving them with
 *      real edits.
 *   2. inside each group, natural path order — `src/bar.ts` next to `src/baz/...` etc.
 */
function sortChanges(changes: GitChange[]): GitChange[] {
  return [...changes].sort((a, b) => {
    if (a.untracked !== b.untracked) return a.untracked ? 1 : -1;
    return PATH_COLLATOR.compare(a.path, b.path);
  });
}

export function ChangesList({ projectId, changes, totals, touched, hunksByPath }: Props) {
  // Sort once per change-set so we don't re-key React rows during unrelated re-renders.
  // `changes` is a fresh array from the store on every status refresh, so the memo bottoms
  // out at the worst-case "sort 100 paths" cost — ~0.1ms on a modern engine.
  const sortedChanges = useMemo(() => sortChanges(changes), [changes]);

  const allPaths = useMemo(() => sortedChanges.map((c) => c.path), [sortedChanges]);
  const [activePath, setActivePath] = useState<string | undefined>(sortedChanges[0]?.path);

  const groupMode = useGroupModeStore((s) => s.mode);
  const setGroupMode = useGroupModeStore((s) => s.setMode);

  // Staging selection lives in a shared store so CommitComposer can read which paths to
  // `git add` before committing. The store auto-defaults to "everything selected" when
  // its per-project entry is empty, which matches the prior local-state behavior.
  const selectedRecord = useStagingStore((s) => s.selectedByProject[projectId]);
  const toggleStaging = useStagingStore((s) => s.toggle);
  const selectAllStaging = useStagingStore((s) => s.selectAll);
  const syncedSelected = useMemo(() => {
    const result = new Set<string>();
    for (const p of allPaths) {
      if (!selectedRecord || selectedRecord.size === 0 || selectedRecord.has(p)) result.add(p);
    }
    return result;
  }, [allPaths, selectedRecord]);

  const toggle = (path: string) => toggleStaging(projectId, path, allPaths);
  const stageAll = () => selectAllStaging(projectId, allPaths);

  const rowProps = {
    touched,
    syncedSelected,
    activePath,
    toggle,
    setActivePath,
  } satisfies SharedRowProps;

  return (
    <div className="pid-git-section pid-git-changes">
      <div className="pid-git-section-head">
        <span className="pid-mono-label">changes</span>
        <span className="pid-tag">{changes.length}</span>
        <span className="pid-git-section-spacer" />
        <GroupModeMenu mode={groupMode} onChange={setGroupMode} />
        <button
          type="button"
          className="pid-git-changes-stage-all"
          onClick={stageAll}
          title="Select all files for the next commit"
        >
          stage all
        </button>
      </div>

      <DiffBarTotals totals={totals} />

      {sortedChanges.length === 0 ? (
        <div className="pid-git-empty">working tree clean</div>
      ) : (
        <div className="pid-git-rows">
          <GroupedRows
            mode={groupMode}
            changes={sortedChanges}
            hunksByPath={hunksByPath}
            shared={rowProps}
          />
        </div>
      )}
    </div>
  );
}

interface SharedRowProps {
  touched: Set<string>;
  syncedSelected: Set<string>;
  activePath: string | undefined;
  toggle: (path: string) => void;
  setActivePath: (path: string) => void;
}

interface GroupedRowsProps {
  mode: GroupMode;
  changes: GitChange[];
  hunksByPath: Record<string, GitHunk[]> | undefined;
  shared: SharedRowProps;
}

function GroupedRows({ mode, changes, hunksByPath, shared }: GroupedRowsProps) {
  if (mode === "hunk")
    return <HunkRows changes={changes} hunksByPath={hunksByPath} shared={shared} />;
  if (mode === "change") return <ChangeTypeRows changes={changes} shared={shared} />;
  if (mode === "folder") return <FolderRows changes={changes} shared={shared} />;
  return <FileRows changes={changes} shared={shared} />;
}

function FileRows({ changes, shared }: { changes: GitChange[]; shared: SharedRowProps }) {
  return (
    <>
      {changes.map((c) => (
        <FileRow key={`${c.path}:${c.status}`} change={c} shared={shared} />
      ))}
    </>
  );
}

function FileRow({
  change,
  shared,
  hidePathDir,
}: {
  change: GitChange;
  shared: SharedRowProps;
  hidePathDir?: boolean;
}) {
  return (
    <ChangeRow
      change={change}
      touched={shared.touched.has(change.path)}
      selected={shared.syncedSelected.has(change.path)}
      active={shared.activePath === change.path}
      onToggle={() => shared.toggle(change.path)}
      onSelect={() => shared.setActivePath(change.path)}
      hidePathDir={hidePathDir}
    />
  );
}

function HunkRows({
  changes,
  hunksByPath,
  shared,
}: {
  changes: GitChange[];
  hunksByPath: Record<string, GitHunk[]> | undefined;
  shared: SharedRowProps;
}) {
  return (
    <>
      {changes.map((c) => {
        const hunks = hunksByPath?.[c.path] ?? [];
        const selected = shared.syncedSelected.has(c.path);
        const isActive = shared.activePath === c.path;
        return (
          <div key={`${c.path}:${c.status}`} className="pid-git-hunk-group">
            <FileRow change={c} shared={shared} />
            {hunks.map((h, i) => (
              <HunkRow
                // Two hunks for the same file cannot start at the same `(oldStart, newStart)`
                // pair, so this key is stable across re-fetches even if a hunk is added or
                // removed earlier in the list.
                key={`${c.path}:${h.oldStart}:${h.newStart}`}
                hunk={h}
                index={i}
                total={hunks.length}
                selected={selected}
                active={isActive}
                onToggle={() => shared.toggle(c.path)}
                onSelect={() => shared.setActivePath(c.path)}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

interface HunkRowProps {
  hunk: GitHunk;
  index: number;
  total: number;
  selected: boolean;
  active: boolean;
  onToggle: () => void;
  onSelect: () => void;
}

function HunkRow({ hunk, index, total, selected, active, onToggle, onSelect }: HunkRowProps) {
  const range = formatHunkRange(hunk);
  // Per-hunk staging would need `git add -p` semantics we don't have yet, so the checkbox
  // mirrors the parent file's intent — clicking either toggles the whole file.
  const stopProp = (e: MouseEvent) => e.stopPropagation();
  return (
    <div className="pid-git-row pid-git-hunk-row" data-active={active || undefined}>
      <input
        type="checkbox"
        className="pid-git-row-check"
        checked={selected}
        onChange={onToggle}
        onClick={stopProp}
        aria-label={`Toggle hunk ${index + 1} of ${total}`}
      />
      <button type="button" className="pid-git-row-body" onClick={onSelect}>
        <span className="pid-git-hunk-tree" aria-hidden>
          └
        </span>
        <span className="pid-git-hunk-tag">@@</span>
        <span className="pid-git-hunk-meta">
          hunk {index + 1}/{total} · {range}
        </span>
        <span className="pid-git-row-counts" aria-hidden>
          {hunk.add > 0 ? <span data-tone="add">+{hunk.add}</span> : null}
          {hunk.del > 0 ? <span data-tone="del">−{hunk.del}</span> : null}
        </span>
      </button>
    </div>
  );
}

function formatHunkRange(h: GitHunk): string {
  // Pure deletions don't exist in the new file (`+0,0`). Show the old-file line range so
  // the user can locate the removed code; otherwise prefer the post-image range, which is
  // what the user will see when they jump to the file.
  if (h.newLines === 0) {
    return h.oldLines <= 1 ? `L${h.oldStart}` : `L${h.oldStart}-L${h.oldStart + h.oldLines - 1}`;
  }
  if (h.newLines === 1) return `L${h.newStart}`;
  return `L${h.newStart}-L${h.newStart + h.newLines - 1}`;
}

interface SectionTotals {
  add: number;
  del: number;
}

function sumTotals(changes: GitChange[]): SectionTotals {
  return changes.reduce<SectionTotals>(
    (acc, c) => ({ add: acc.add + c.add, del: acc.del + c.del }),
    { add: 0, del: 0 },
  );
}

function ChangeTypeRows({ changes, shared }: { changes: GitChange[]; shared: SharedRowProps }) {
  const groups = useMemo(() => groupByChangeType(changes), [changes]);
  return (
    <>
      {groups.map((group) => (
        <section key={group.kind} className="pid-git-rowgroup">
          <header className="pid-git-rowgroup-head" data-tone={group.tone}>
            <span className="pid-git-rowgroup-glyph" aria-hidden>
              {group.glyph}
            </span>
            <span className="pid-git-rowgroup-label">{group.label}</span>
            <span className="pid-git-rowgroup-count">{group.changes.length}</span>
            <span className="pid-git-rowgroup-spacer" />
            <SectionCounts totals={group.totals} />
          </header>
          {group.changes.map((c) => (
            <FileRow key={`${c.path}:${c.status}`} change={c} shared={shared} />
          ))}
        </section>
      ))}
    </>
  );
}

interface ChangeTypeGroup {
  kind: "added" | "modified" | "deleted" | "untracked";
  label: string;
  glyph: string;
  tone: "add" | "mod" | "del" | "unt";
  changes: GitChange[];
  totals: SectionTotals;
}

function groupByChangeType(changes: GitChange[]): ChangeTypeGroup[] {
  const buckets: Record<ChangeTypeGroup["kind"], GitChange[]> = {
    added: [],
    modified: [],
    deleted: [],
    untracked: [],
  };
  for (const c of changes) {
    if (c.status === "A") buckets.added.push(c);
    else if (c.status === "D") buckets.deleted.push(c);
    else if (c.status === "?") buckets.untracked.push(c);
    else buckets.modified.push(c); // M, R, C, U
  }
  const defs: {
    kind: ChangeTypeGroup["kind"];
    label: string;
    glyph: string;
    tone: ChangeTypeGroup["tone"];
  }[] = [
    { kind: "added", label: "added", glyph: "+", tone: "add" },
    { kind: "modified", label: "modified", glyph: "○", tone: "mod" },
    { kind: "deleted", label: "deleted", glyph: "−", tone: "del" },
    { kind: "untracked", label: "untracked", glyph: "?", tone: "unt" },
  ];
  return defs
    .map((d) => ({ ...d, changes: buckets[d.kind], totals: sumTotals(buckets[d.kind]) }))
    .filter((g) => g.changes.length > 0);
}

function FolderRows({ changes, shared }: { changes: GitChange[]; shared: SharedRowProps }) {
  const groups = useMemo(() => groupByFolder(changes), [changes]);
  return (
    <>
      {groups.map((group) => (
        <section key={group.dir} className="pid-git-rowgroup">
          <header className="pid-git-rowgroup-head">
            <span className="pid-git-rowgroup-glyph" aria-hidden>
              <Folder size={11} />
            </span>
            <span className="pid-git-rowgroup-label">{group.dir || "·"}</span>
            <span className="pid-git-rowgroup-sep">·</span>
            <span className="pid-git-rowgroup-count">{group.changes.length}</span>
            <span className="pid-git-rowgroup-spacer" />
            <SectionCounts totals={group.totals} />
          </header>
          {group.changes.map((c) => (
            <FileRow key={`${c.path}:${c.status}`} change={c} shared={shared} hidePathDir />
          ))}
        </section>
      ))}
    </>
  );
}

interface FolderGroup {
  dir: string;
  changes: GitChange[];
  totals: SectionTotals;
}

function groupByFolder(changes: GitChange[]): FolderGroup[] {
  const byDir = new Map<string, GitChange[]>();
  for (const c of changes) {
    const ix = c.path.lastIndexOf("/");
    const dir = ix < 0 ? "" : c.path.slice(0, ix);
    const list = byDir.get(dir);
    if (list) list.push(c);
    else byDir.set(dir, [c]);
  }
  return [...byDir.entries()]
    .sort(([a], [b]) => {
      // Root files ("") sink below nested folders, matching how IDE explorers render
      // a "root" pseudo-group after the named ones.
      if ((a === "") !== (b === "")) return a === "" ? 1 : -1;
      return PATH_COLLATOR.compare(a, b);
    })
    .map(([dir, list]) => ({ dir, changes: list, totals: sumTotals(list) }));
}

function SectionCounts({ totals }: { totals: SectionTotals }) {
  return (
    <span className="pid-git-rowgroup-counts" aria-hidden>
      {totals.add > 0 ? <span data-tone="add">+{totals.add}</span> : null}
      {totals.del > 0 ? <span data-tone="del">−{totals.del}</span> : null}
    </span>
  );
}

function DiffBarTotals({ totals }: { totals: { add: number; del: number } }) {
  const sum = totals.add + totals.del;
  return (
    <div className="pid-git-diffbar-row">
      <div className="pid-git-diffbar" aria-hidden>
        {sum > 0 ? (
          <>
            <div
              className="pid-git-diffbar-add"
              style={{ width: `${(totals.add / sum) * 100}%` }}
            />
            <div
              className="pid-git-diffbar-del"
              style={{ width: `${(totals.del / sum) * 100}%` }}
            />
          </>
        ) : (
          <div className="pid-git-diffbar-empty" />
        )}
      </div>
      <span className="pid-git-diffbar-totals" aria-hidden>
        <span data-tone="add">+{totals.add}</span>
        <span className="pid-git-diffbar-sep">·</span>
        <span data-tone="del">−{totals.del}</span>
      </span>
    </div>
  );
}
