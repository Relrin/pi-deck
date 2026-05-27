import type { FsNode } from "@pi-deck/core/fs/types.js";
import type { GitChange, GitChangeStatus } from "@pi-deck/core/git/types.js";
import { useVirtualizer } from "@tanstack/react-virtual";
import Fuse from "fuse.js";
import {
  type DragEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronsDownUp,
  FilePlus,
  FolderPlus,
  Pencil,
  RefreshCw,
  Trash2,
} from "../../components/icons/index.js";
import { ContextMenu, type ContextMenuItem } from "../../components/ui/ContextMenu.js";
import { useGitStore } from "../git/useGitStore.js";
import { useProjectsStore } from "../sessions/useProjectsStore.js";
import { buildDragPayload, PIDECK_PATHS_MIME } from "./dragDrop.js";
import { PidConfirmDeleteDialog } from "./PidConfirmDeleteDialog.js";
import { PidFileTreeEmptyState } from "./PidFileTreeEmptyState.js";
import { PidFileTreeFilter } from "./PidFileTreeFilter.js";
import type { RowStatusTone } from "./PidFileTreeRow.js";
import { PidFileTreeRow } from "./PidFileTreeRow.js";
import { useFileTreeKeyboard } from "./useFileTreeKeyboard.js";
import { flattenVisible, useFileTreeStore, type VisibleRow } from "./useFileTreeStore.js";

const ROW_HEIGHT = 24;
const VIRTUALIZER_OVERSCAN = 12;

/** Stable reference so `gitTotals ?? EMPTY_TOTALS` doesn't allocate per render. */
const EMPTY_TOTALS = { add: 0, del: 0 } as const;

export function PidFileTree() {
  const projectId = useProjectsStore((s) => s.activeProjectId);
  const project = useProjectsStore((s) =>
    s.activeProjectId ? s.projects.find((p) => p.id === s.activeProjectId) : undefined,
  );

  // Slice selectors: subscribe to only what each block actually consumes, so a pure
  // selection click doesn't invalidate the (expensive) visible-rows or fuse-index memos.
  // Zustand uses Object.is so each slice only re-fires when its underlying field is replaced.
  const nodes = useFileTreeStore((s) => (projectId ? s.byProject[projectId]?.nodes : undefined));
  const expanded = useFileTreeStore((s) =>
    projectId ? s.byProject[projectId]?.expanded : undefined,
  );
  const selected = useFileTreeStore((s) =>
    projectId ? s.byProject[projectId]?.selected : undefined,
  );
  const selectionAnchor = useFileTreeStore((s) =>
    projectId ? s.byProject[projectId]?.selectionAnchor : undefined,
  );
  const filter = useFileTreeStore((s) => (projectId ? (s.byProject[projectId]?.filter ?? "") : ""));
  const editing = useFileTreeStore((s) =>
    projectId ? s.byProject[projectId]?.editing : undefined,
  );
  const root = useFileTreeStore((s) => (projectId ? s.byProject[projectId]?.root : undefined));
  const treeError = useFileTreeStore((s) =>
    projectId ? s.byProject[projectId]?.error : undefined,
  );

  // Actions are stable identities in Zustand — `s.toggleExpanded` returns the same reference
  // on every snapshot, so these selectors never trigger a re-render on their own.
  const ensureTree = useFileTreeStore((s) => s.ensureTree);
  const refreshTree = useFileTreeStore((s) => s.refreshTree);
  const setFilter = useFileTreeStore((s) => s.setFilter);
  const collapseAll = useFileTreeStore((s) => s.collapseAll);
  const beginCreateFile = useFileTreeStore((s) => s.beginCreateFile);
  const beginCreateFolder = useFileTreeStore((s) => s.beginCreateFolder);
  const beginRename = useFileTreeStore((s) => s.beginRename);
  const commitEditing = useFileTreeStore((s) => s.commitEditing);
  const cancelEditing = useFileTreeStore((s) => s.cancelEditing);
  const selectOne = useFileTreeStore((s) => s.selectOne);
  const toggleSelected = useFileTreeStore((s) => s.toggleSelected);
  const selectRange = useFileTreeStore((s) => s.selectRange);
  const toggleExpanded = useFileTreeStore((s) => s.toggleExpanded);
  const deletePaths = useFileTreeStore((s) => s.deletePaths);

  const gitChanges = useGitStore((s) =>
    projectId ? s.statusByProject[projectId]?.changes : undefined,
  );
  const gitRoot = useGitStore((s) => (projectId ? s.statusByProject[projectId]?.root : undefined));
  const gitTotals = useGitStore((s) =>
    projectId ? s.statusByProject[projectId]?.totals : undefined,
  );

  const scrollerRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  const [pendingDelete, setPendingDelete] = useState<string[] | undefined>(undefined);

  // Walk the project on first mount + when projectId changes. The host caches the snapshot,
  // so re-renders of this component are cheap.
  useEffect(() => {
    if (!projectId) return;
    void ensureTree(projectId);
  }, [projectId, ensureTree]);

  // Flatten-by-expansion. Depends on (nodes, expanded) only — selection / editing / filter
  // changes are no-ops for this memo, which is the main perf win on expand-toggle clicks.
  const baseVisible = useMemo<VisibleRow[]>(() => {
    if (!nodes || !expanded) return [];
    return flattenVisible(nodes, expanded);
  }, [nodes, expanded]);

  // Pre-built fuse index keyed on `nodes` alone. Rebuilding once per fs-tree change (not
  // per keystroke or per expand) is the second big perf win — index construction is the
  // dominant cost when filtering large repos.
  const fuseIndex = useMemo(() => {
    if (!nodes) return undefined;
    const files: FsNode[] = [];
    collectFiles(nodes, files);
    return new Fuse(files, {
      keys: [{ name: "relPath", weight: 1 }],
      threshold: 0.4,
      ignoreLocation: true,
      includeMatches: false,
    });
  }, [nodes]);

  const visibleRows = useMemo<VisibleRow[]>(() => {
    let rows: VisibleRow[];
    if (filter.trim().length === 0) {
      rows = baseVisible;
    } else if (!nodes || !fuseIndex || !root) {
      rows = [];
    } else {
      rows = applyFuseFilter(nodes, root, fuseIndex, filter);
    }
    // Splice a synthetic draft row into the list when a create-file / create-folder edit is
    // active, so the input lands as a child of the right-clicked folder at the proper depth
    // — not at the top of the scroll container.
    if (editing && editing.mode !== "rename" && root) {
      rows = spliceInDraft(rows, editing, root);
    }
    return rows;
  }, [baseVisible, filter, fuseIndex, nodes, root, editing]);

  const visibleNodeTypes = useMemo<Map<string, "file" | "dir">>(() => {
    const map = new Map<string, "file" | "dir">();
    for (const row of visibleRows) map.set(row.path, row.node.type);
    return map;
  }, [visibleRows]);

  // Status badge per path.
  const badgeByPath = useMemo<Map<string, { letter: "A" | "M" | "D" | "?"; tone: RowStatusTone }>>(
    () => buildBadgeMap(gitChanges ?? [], gitRoot, root),
    [gitChanges, gitRoot, root],
  );

  const totals = gitTotals ?? EMPTY_TOTALS;

  const virtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: VIRTUALIZER_OVERSCAN,
  });

  const requestDelete = useCallback((paths: string[]) => {
    if (paths.length === 0) return;
    setPendingDelete(paths);
  }, []);

  const onKeyDown = useFileTreeKeyboard({
    projectId,
    visibleRows,
    onRequestDelete: requestDelete,
  });

  const onSelectRow = useCallback(
    (event: MouseEvent<HTMLDivElement>, row: VisibleRow) => {
      if (!projectId) return;
      // The tree's editing state should NOT survive a click elsewhere — defensive cancel so
      // the user doesn't end up with an orphaned input when they click a sibling.
      if (editing && editing.mode === "rename" && editing.path !== row.path) {
        cancelEditing(projectId);
      }
      if (event.shiftKey && selectionAnchor) {
        selectRange(projectId, selectionAnchor, row.path);
      } else if (event.ctrlKey || event.metaKey) {
        toggleSelected(projectId, row.path);
      } else {
        selectOne(projectId, row.path);
      }
      // Keep keyboard focus on the tree body so F2 / Delete fire immediately after a click.
      scrollerRef.current?.focus({ preventScroll: true });
    },
    [projectId, editing, selectionAnchor, cancelEditing, selectRange, toggleSelected, selectOne],
  );

  const onDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>, row: VisibleRow) => {
      if (!selected) return;
      // Multi-select pull-in: if the dragged row is part of the selection, drag all of it.
      const dragSelection = selected.has(row.path) ? selected : new Set([row.path]);
      const { mimePayload, rowCount } = buildDragPayload(row, dragSelection, visibleNodeTypes);
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData(PIDECK_PATHS_MIME, mimePayload);
      // Also stash a plaintext fallback so dragging into a text editor produces something
      // useful (the paths, one per line).
      const paths = rowCount > 1 && selected.has(row.path) ? [...selected] : [row.path];
      event.dataTransfer.setData("text/plain", paths.join("\n"));
    },
    [selected, visibleNodeTypes],
  );

  const onCommitEditing = useCallback(
    (value: string) => {
      if (!projectId) return;
      void commitEditing(projectId, value);
    },
    [projectId, commitEditing],
  );

  const onCancelEditing = useCallback(() => {
    if (!projectId) return;
    cancelEditing(projectId);
  }, [projectId, cancelEditing]);

  // Per-row callbacks. Hoisted to one stable reference each so React.memo on the row
  // component can actually short-circuit on selection-only re-renders.
  const onRowToggleExpand = useCallback(
    (r: VisibleRow) => {
      if (!projectId) return;
      toggleExpanded(projectId, r.path);
    },
    [projectId, toggleExpanded],
  );
  const onRowContextMenu = useCallback(
    (_e: MouseEvent<HTMLDivElement>, r: VisibleRow) => {
      if (!projectId) return;
      // Radix ContextMenu owns the actual open; we just make sure the row is selected so
      // the rendered menu reflects the right target.
      if (!selected?.has(r.path)) selectOne(projectId, r.path);
    },
    [projectId, selected, selectOne],
  );

  // ---- Empty states ----
  if (!projectId || !project) {
    return (
      <div className="pid-tree-shell">
        <PidFileTreeEmptyState kind="no-project" />
      </div>
    );
  }
  if (treeError) {
    return (
      <div className="pid-tree-shell">
        <PidFileTreeEmptyState kind="error" errorMessage={treeError} />
      </div>
    );
  }

  const rootContextItems = buildRootContextMenu({
    onNewFile: () => beginCreateFile(projectId, root ?? project.path),
    onNewFolder: () => beginCreateFolder(projectId, root ?? project.path),
    onRefresh: () => void refreshTree(projectId),
    onCollapseAll: () => collapseAll(projectId),
  });

  // The editing draft row, when create-file/create-folder is active and we're at the right depth.
  const editingDraft = editing;

  return (
    <div className="pid-tree-shell">
      <div className="pid-tree-header">
        <span className="pid-mono-label">{project.displayName}</span>
        <span className="pid-tree-header-spacer" />
        {totals.add > 0 ? (
          <span className="pid-tree-header-total" data-tone="add">
            +{totals.add}
          </span>
        ) : null}
        {totals.del > 0 ? (
          <span className="pid-tree-header-total" data-tone="del">
            −{totals.del}
          </span>
        ) : null}
      </div>
      <div className="pid-tree-filter-row">
        <PidFileTreeFilter
          ref={filterRef}
          value={filter}
          onChange={(v) => setFilter(projectId, v)}
          onArrowDown={() => {
            // Move focus into the tree body — selecting the first visible row.
            const first = visibleRows[0];
            if (first) selectOne(projectId, first.path);
            scrollerRef.current?.focus();
          }}
        />
      </div>
      <ContextMenu items={rootContextItems}>
        <div
          ref={scrollerRef}
          tabIndex={0}
          role="tree"
          aria-label="Project files"
          className="pid-tree-body"
          onKeyDown={onKeyDown}
          onClick={(e) => {
            // Clicking the empty space below rows clears the selection — matches Finder.
            if (e.target === e.currentTarget) {
              useFileTreeStore.getState().clearSelection(projectId);
            }
          }}
        >
          {visibleRows.length === 0 ? (
            <PidFileTreeEmptyState kind={filter ? "no-matches" : "empty-project"} />
          ) : (
            <div
              className="pid-tree-virt"
              style={{
                height: virtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtual) => {
                const row = visibleRows[virtual.index];
                if (!row) return null;

                const itemStyle = {
                  position: "absolute" as const,
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${virtual.start}px)`,
                  height: ROW_HEIGHT,
                };

                // Draft rows (create-file / create-folder) are spliced into visibleRows at
                // the parent's child-depth by `spliceInDraft`. They render an inline-edit
                // input directly — no context menu wrapper, no PidFileTreeRow.
                if (row.draft) {
                  return (
                    <div key="__draft__" className="pid-tree-virt-item" style={itemStyle}>
                      <DraftEditRow
                        depth={row.depth}
                        mode={row.draft.mode}
                        onCommit={onCommitEditing}
                        onCancel={onCancelEditing}
                      />
                    </div>
                  );
                }

                const isSelected = selected?.has(row.path) ?? false;
                const badge = badgeByPath.get(row.path);
                const isEditingThis =
                  editingDraft?.mode === "rename" && editingDraft.path === row.path;

                const rowContextItems = buildRowContextMenu({
                  isDir: row.node.type === "dir",
                  onNewFile: () =>
                    beginCreateFile(
                      projectId,
                      row.node.type === "dir" ? row.path : parentOf(row.path),
                    ),
                  onNewFolder: () =>
                    beginCreateFolder(
                      projectId,
                      row.node.type === "dir" ? row.path : parentOf(row.path),
                    ),
                  onRename: () => beginRename(projectId, row.path),
                  onDelete: () => {
                    // Right-click on a row not currently in the selection should act on
                    // just that row. If it IS in the selection, act on the whole batch.
                    const targets = selected?.has(row.path) ? [...selected] : [row.path];
                    requestDelete(targets);
                  },
                });

                return (
                  <div key={row.path} className="pid-tree-virt-item" style={itemStyle}>
                    <ContextMenu items={rowContextItems}>
                      <PidFileTreeRow
                        projectId={projectId}
                        row={row}
                        statusBadge={badge}
                        isSelected={isSelected}
                        editingInitialValue={isEditingThis ? row.node.name : undefined}
                        onSelect={onSelectRow}
                        onToggleExpand={onRowToggleExpand}
                        onContextMenu={onRowContextMenu}
                        onCommitEdit={onCommitEditing}
                        onCancelEdit={onCancelEditing}
                        onDragStart={onDragStart}
                      />
                    </ContextMenu>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ContextMenu>

      {pendingDelete && (
        <PidConfirmDeleteDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(undefined);
          }}
          paths={pendingDelete}
          projectRoot={root || project.path}
          onConfirm={async () => {
            await deletePaths(projectId, pendingDelete);
            setPendingDelete(undefined);
          }}
        />
      )}
    </div>
  );
}

interface DraftEditRowProps {
  /** Indent depth in the visible-rows list. Passed directly from the spliced row so we
   * don't have to recompute from the parent dir + project root. */
  depth: number;
  mode: "create-file" | "create-folder";
  onCommit: (value: string) => void;
  onCancel: () => void;
}

function DraftEditRow({ depth, mode, onCommit, onCancel }: DraftEditRowProps) {
  return (
    <div
      className="pid-tree-row pid-tree-row-draft"
      data-depth={depth}
      style={{ paddingLeft: 14 + depth * 14 }}
    >
      <span className="pid-tree-row-arrow" aria-hidden />
      <span className="pid-tree-row-icon" aria-hidden>
        {mode === "create-folder" ? <FolderPlus size={14} /> : <FilePlus size={14} />}
      </span>
      <DraftInput onCommit={onCommit} onCancel={onCancel} />
    </div>
  );
}

function DraftInput({
  onCommit,
  onCancel,
}: {
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // Mirrors the cancelledRef pattern in InlineEditInput: when Escape fires onCancel, React
  // unmounts the input; the trailing onBlur must NOT then commit-with-typed-text.
  const cancelledRef = useRef(false);

  useEffect(() => {
    // Deferred past Radix's context-menu close cleanup — without rAF, the first paint after
    // picking "New file…" lands focus on the menu trigger and the user has to click the
    // input manually.
    const id = requestAnimationFrame(() => {
      ref.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <input
      ref={ref}
      defaultValue=""
      className="pid-tree-row-input"
      aria-label="New name"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(e.currentTarget.value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancelledRef.current = true;
          onCancel();
        }
      }}
      onBlur={(e) => {
        if (cancelledRef.current) return;
        // Empty blur = cancel; any typed name commits.
        if (e.currentTarget.value.trim().length === 0) onCancel();
        else onCommit(e.currentTarget.value);
      }}
    />
  );
}

/**
 * Splice a synthetic draft row into the visible list at the parent dir's child-depth.
 *
 * The draft lands right after `parentDir` and all of its currently-visible descendants, so
 * visually it appears as the last child of the folder the user invoked "New file…" /
 * "New folder…" on. Drafts rooted at the project root (right-click on empty space) go to
 * the end of the top-level rows.
 *
 * Returning a NEW array preserves React-virtual's identity assumptions; mutating in-place
 * would confuse the virtualizer's measurement cache.
 */
function spliceInDraft(
  rows: VisibleRow[],
  editing: { mode: "create-file" | "create-folder"; parentDir: string },
  root: string,
): VisibleRow[] {
  const draftMarker = { mode: editing.mode, parentDir: editing.parentDir } as const;
  const rootPosix = root.replace(/\\/g, "/");
  const parentPosix = editing.parentDir.replace(/\\/g, "/");

  // Root-level draft: insert at the end of the top-level rows. We can't just push to the
  // array end because deeper rows from an expanded subtree may already trail the last
  // top-level row; instead, find the LAST depth-0 row and place the draft right after its
  // visible descendants. Falls back to "append" if no depth-0 row exists yet.
  if (parentPosix === rootPosix || !rootPosix) {
    const lastTopLevelIdx = findLastIndex(rows, (r) => r.depth === 0);
    if (lastTopLevelIdx < 0) {
      return [...rows, makeDraftRow(0, draftMarker)];
    }
    const insertIdx = trailingDescendantsEnd(rows, lastTopLevelIdx, 0);
    return spliceArray(rows, insertIdx, makeDraftRow(0, draftMarker));
  }

  // Non-root: find the parent in the visible list. If it isn't visible (e.g. filter is
  // active and the parent was filtered out), append at the end — the user still sees an
  // input, just docked at the bottom of the filtered view.
  const parentIdx = rows.findIndex((r) => r.path === parentPosix);
  if (parentIdx < 0) {
    return [...rows, makeDraftRow(0, draftMarker)];
  }
  const parentDepth = rows[parentIdx]?.depth ?? 0;
  const insertIdx = trailingDescendantsEnd(rows, parentIdx, parentDepth);
  return spliceArray(rows, insertIdx, makeDraftRow(parentDepth + 1, draftMarker));
}

function makeDraftRow(
  depth: number,
  draft: { mode: "create-file" | "create-folder"; parentDir: string },
): VisibleRow {
  return {
    node: {
      // Placeholder node so consumers that read row.node.* don't choke. The path / relPath
      // sentinels never collide with real entries (they don't start with the project root).
      path: "__draft__",
      name: "",
      type: draft.mode === "create-folder" ? "dir" : "file",
      relPath: "",
    },
    depth,
    relPath: "",
    path: "__draft__",
    isExpanded: false,
    draft,
  };
}

/** Walk forward from `startIdx` past all rows with depth > parentDepth. Returns the index
 * of the first row that's NOT a descendant — i.e. the splice position. */
function trailingDescendantsEnd(rows: VisibleRow[], startIdx: number, parentDepth: number): number {
  let idx = startIdx + 1;
  while (idx < rows.length) {
    const next = rows[idx];
    if (!next || next.depth <= parentDepth) break;
    idx++;
  }
  return idx;
}

function findLastIndex<T>(arr: T[], pred: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    const item = arr[i];
    if (item !== undefined && pred(item)) return i;
  }
  return -1;
}

function spliceArray<T>(arr: T[], idx: number, value: T): T[] {
  return [...arr.slice(0, idx), value, ...arr.slice(idx)];
}

function parentOf(path: string): string {
  const ix = path.lastIndexOf("/");
  return ix > 0 ? path.slice(0, ix) : path;
}

interface BuildRootMenuArgs {
  onNewFile: () => void;
  onNewFolder: () => void;
  onRefresh: () => void;
  onCollapseAll: () => void;
}

/**
 * Root-area (empty-space) context menu. The footer used to expose New file / New folder /
 * Refresh / Collapse all — those actions now live here so the rail stays compact and the
 * tree body is the only surface that needs vertical space.
 */
function buildRootContextMenu(args: BuildRootMenuArgs): ContextMenuItem[] {
  return [
    {
      kind: "action",
      label: "New file",
      onSelect: args.onNewFile,
      icon: <FilePlus size={12} />,
    },
    {
      kind: "action",
      label: "New folder",
      onSelect: args.onNewFolder,
      icon: <FolderPlus size={12} />,
    },
    { kind: "separator" },
    {
      kind: "action",
      label: "Refresh",
      onSelect: args.onRefresh,
      icon: <RefreshCw size={12} />,
    },
    {
      kind: "action",
      label: "Collapse all",
      onSelect: args.onCollapseAll,
      icon: <ChevronsDownUp size={12} />,
    },
  ];
}

interface BuildRowMenuArgs {
  isDir: boolean;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function buildRowContextMenu(args: BuildRowMenuArgs): ContextMenuItem[] {
  return [
    {
      kind: "action",
      label: "New file",
      onSelect: args.onNewFile,
      icon: <FilePlus size={12} />,
    },
    {
      kind: "action",
      label: "New folder",
      onSelect: args.onNewFolder,
      icon: <FolderPlus size={12} />,
    },
    { kind: "separator" },
    {
      kind: "action",
      label: "Rename…",
      onSelect: args.onRename,
      shortcut: "F2",
      icon: <Pencil size={12} />,
    },
    {
      kind: "action",
      label: "Move to Trash",
      onSelect: args.onDelete,
      danger: true,
      shortcut: "Del",
      icon: <Trash2 size={12} />,
    },
  ];
}

/**
 * Build a path → badge map from the GitStatus changes list. Git stores paths repo-relative
 * with forward slashes; we resolve them against `tree.root` (which is also forward-slash and
 * matches `gitStatus.root` in practice) so the lookup keys match the tree rows.
 */
function buildBadgeMap(
  changes: GitChange[],
  gitRoot: string | undefined,
  treeRoot: string | undefined,
): Map<string, { letter: "A" | "M" | "D" | "?"; tone: RowStatusTone }> {
  const map = new Map<string, { letter: "A" | "M" | "D" | "?"; tone: RowStatusTone }>();
  const root = (gitRoot || treeRoot || "").replace(/\\/g, "/");
  if (!root) return map;
  for (const change of changes) {
    const abs = `${root}/${change.path}`;
    map.set(abs, statusToBadge(change.status));
  }
  return map;
}

function statusToBadge(status: GitChangeStatus): {
  letter: "A" | "M" | "D" | "?";
  tone: RowStatusTone;
} {
  if (status === "A") return { letter: "A", tone: "add" };
  if (status === "D") return { letter: "D", tone: "del" };
  if (status === "?") return { letter: "?", tone: "unt" };
  // M, R, C, U all visualise as "modified" — the tree is a coarser surface than the git
  // sidebar, where the distinction does matter.
  return { letter: "M", tone: "mod" };
}

/**
 * Apply fuse fuzzy matching against a pre-built index, returning the rows that match plus
 * every ancestor directory of every match (so the user can see WHERE each hit lives).
 *
 * Fuse keys off the project-relative path so typing `lib/tok` matches `src/lib/tokens.ts`
 * via the `lib/tok` substring, and typing `amsg` matches `AgentMessage.tsx` via fuzzy.
 *
 * The `fuse` instance is built once per fs-tree change (memoized by the caller); only the
 * lightweight `.search()` + the result-walk run on each keystroke.
 */
function applyFuseFilter(
  nodes: FsNode[],
  root: string,
  fuse: Fuse<FsNode>,
  query: string,
): VisibleRow[] {
  const matches = fuse.search(query.trim()).map((r) => r.item);
  if (matches.length === 0) return [];

  // Set of paths that need to be visible: every match + every ancestor.
  const visible = new Set<string>();
  for (const node of matches) {
    visible.add(node.path);
    addAncestors(node.path, root, visible);
  }

  // Re-walk the tree, emitting only nodes whose path is in `visible`. Dirs with at least
  // one visible descendant are themselves visible (their ancestor-add above ensures this).
  const out: VisibleRow[] = [];
  walk(nodes, 0);
  return out;

  function walk(items: FsNode[], depth: number): void {
    for (const node of items) {
      if (!visible.has(node.path)) continue;
      const isDir = node.type === "dir";
      out.push({
        node,
        depth,
        relPath: node.relPath,
        path: node.path,
        // Force-expand every matched directory so children render.
        isExpanded: isDir,
      });
      if (isDir && node.children) walk(node.children, depth + 1);
    }
  }
}

function collectFiles(nodes: FsNode[], out: FsNode[]): void {
  for (const node of nodes) {
    if (node.type === "file") {
      out.push(node);
    } else if (node.children) {
      collectFiles(node.children, out);
    }
  }
}

function addAncestors(absPath: string, root: string, into: Set<string>): void {
  const rootPosix = (root || "").replace(/\\/g, "/");
  if (!rootPosix || !absPath.startsWith(`${rootPosix}/`)) return;
  const rel = absPath.slice(rootPosix.length + 1);
  const parts = rel.split("/");
  let cursor = rootPosix;
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i];
    if (!seg) continue;
    cursor = `${cursor}/${seg}`;
    into.add(cursor);
  }
}
