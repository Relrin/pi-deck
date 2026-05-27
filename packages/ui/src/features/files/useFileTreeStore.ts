import type { FsNode } from "@pi-deck/core/fs/types.js";
import { create } from "zustand";
import { humanizeError } from "../../lib/format/humanize-error.js";
import { useNotificationStore } from "../_status/useNotificationStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";

/**
 * One project's tree snapshot. Trees are kept per-project so switching projects doesn't
 * blow away the file-tree state — selection, expansion, and filter all live here.
 */
export interface ProjectTreeState {
  root: string;
  nodes: FsNode[];
  /** Absolute paths of expanded directories. */
  expanded: Set<string>;
  /** Absolute paths of selected rows. Single-click replaces the set; Ctrl/Cmd-click toggles. */
  selected: Set<string>;
  /** The last single-clicked row — anchor for Shift-click range selection. */
  selectionAnchor: string | undefined;
  /** Filter input value (raw, undebounced). The visible-rows selector applies fuse matching. */
  filter: string;
  /** Snapshot of `expanded` taken when filter first became non-empty; restored on clear. */
  expandedBeforeFilter: Set<string> | undefined;
  /** Inline-edit state: F2 rename, or "create-file" / "create-folder" draft row. */
  editing: EditingState | undefined;
  /** Walk loading flag; UI shows a tiny spinner if true and `nodes` is empty. */
  loading: boolean;
  /** Last error message; rendered in the empty-state component. */
  error: string | undefined;
}

export type EditingState =
  | { mode: "rename"; path: string }
  /** New-file / new-folder drafts are keyed by the parent directory absolute path. The row
   * label is editable; pressing Enter fires `fs.create*` and clears the draft. */
  | { mode: "create-file"; parentDir: string }
  | { mode: "create-folder"; parentDir: string };

interface FileTreeStoreState {
  /** Per-project state. Null entries mean "loading" — the store renders an empty state. */
  byProject: Record<string, ProjectTreeState | undefined>;

  ensureTree: (projectId: string) => Promise<void>;
  refreshTree: (projectId: string) => Promise<void>;
  /** Watcher-driven delta applied from the event router. */
  applyTreeChanged: (projectId: string, added: FsNode[], removed: string[]) => void;

  toggleExpanded: (projectId: string, path: string) => void;
  setExpanded: (projectId: string, path: string, open: boolean) => void;
  expandAncestors: (projectId: string, path: string) => void;
  collapseAll: (projectId: string) => void;

  selectOne: (projectId: string, path: string) => void;
  toggleSelected: (projectId: string, path: string) => void;
  selectRange: (projectId: string, fromPath: string, toPath: string) => void;
  clearSelection: (projectId: string) => void;

  setFilter: (projectId: string, value: string) => void;

  beginRename: (projectId: string, path: string) => void;
  beginCreateFile: (projectId: string, parentDir: string) => void;
  beginCreateFolder: (projectId: string, parentDir: string) => void;
  cancelEditing: (projectId: string) => void;

  /** Commit an inline edit. Throws if the host rejects; caller keeps the input open on
   * error so the user can correct the name. */
  commitEditing: (projectId: string, value: string) => Promise<void>;
  deletePaths: (projectId: string, paths: string[]) => Promise<void>;
}

const treeInflight = new Map<string, Promise<void>>();

export const useFileTreeStore = create<FileTreeStoreState>((set, get) => ({
  byProject: {},

  ensureTree: async (projectId) => {
    const existing = get().byProject[projectId];
    if (existing && existing.nodes.length > 0) return;
    await get().refreshTree(projectId);
  },

  refreshTree: async (projectId) => {
    const pending = treeInflight.get(projectId);
    if (pending) return pending;
    const client = useSessionsStore.getState().client;
    if (!client) return;

    set((state) => {
      const existing = state.byProject[projectId];
      return {
        byProject: {
          ...state.byProject,
          [projectId]: existing
            ? { ...existing, loading: true, error: undefined }
            : emptyTree(projectId, { loading: true }),
        },
      };
    });

    const run = (async () => {
      try {
        const { root, nodes } = await client.call("fs.tree", { projectId });
        set((state) => {
          const existing = state.byProject[projectId];
          return {
            byProject: {
              ...state.byProject,
              [projectId]: {
                ...(existing ?? emptyTree(projectId)),
                root,
                nodes,
                loading: false,
                error: undefined,
              },
            },
          };
        });
      } catch (err) {
        const message = humanizeError(err, "Failed to load project files");
        set((state) => {
          const existing = state.byProject[projectId];
          return {
            byProject: {
              ...state.byProject,
              [projectId]: {
                ...(existing ?? emptyTree(projectId)),
                loading: false,
                error: message,
              },
            },
          };
        });
      } finally {
        treeInflight.delete(projectId);
      }
    })();
    treeInflight.set(projectId, run);
    return run;
  },

  applyTreeChanged: (projectId, added, removed) => {
    set((state) => {
      const existing = state.byProject[projectId];
      if (!existing) return state;
      // Mutate-by-clone: the watcher's debounced delta is small, but the tree can be big.
      // We rebuild only the affected dir branches via the helpers below.
      const nodes = applyDelta(existing.nodes, existing.root, added, removed);
      // Drop any selection / expansion entries that point at paths we just removed.
      let selected = existing.selected;
      let expanded = existing.expanded;
      if (removed.length > 0) {
        selected = prunePaths(existing.selected, removed);
        expanded = prunePaths(existing.expanded, removed);
      }
      return {
        byProject: {
          ...state.byProject,
          [projectId]: { ...existing, nodes, selected, expanded },
        },
      };
    });
  },

  toggleExpanded: (projectId, path) => {
    const tree = get().byProject[projectId];
    if (!tree) return;
    get().setExpanded(projectId, path, !tree.expanded.has(path));
  },

  setExpanded: (projectId, path, open) => {
    set((state) => {
      const tree = state.byProject[projectId];
      if (!tree) return state;
      const next = new Set(tree.expanded);
      if (open) next.add(path);
      else next.delete(path);
      return {
        byProject: { ...state.byProject, [projectId]: { ...tree, expanded: next } },
      };
    });
  },

  expandAncestors: (projectId, path) => {
    const tree = get().byProject[projectId];
    if (!tree) return;
    const next = new Set(tree.expanded);
    // Walk up the path segments, expanding every parent. `path` itself isn't expanded —
    // callers decide whether to reveal its children.
    const segments = path.split("/");
    let cursor = "";
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (!seg) {
        // Leading slash on POSIX paths — preserved as an empty segment.
        cursor = "";
        continue;
      }
      cursor = cursor.length === 0 ? seg : `${cursor}/${seg}`;
      next.add(cursor);
    }
    set((state) => ({
      byProject: { ...state.byProject, [projectId]: { ...tree, expanded: next } },
    }));
  },

  collapseAll: (projectId) => {
    set((state) => {
      const tree = state.byProject[projectId];
      if (!tree) return state;
      return {
        byProject: { ...state.byProject, [projectId]: { ...tree, expanded: new Set() } },
      };
    });
  },

  selectOne: (projectId, path) => {
    set((state) => {
      const tree = state.byProject[projectId];
      if (!tree) return state;
      return {
        byProject: {
          ...state.byProject,
          [projectId]: {
            ...tree,
            selected: new Set([path]),
            selectionAnchor: path,
          },
        },
      };
    });
  },

  toggleSelected: (projectId, path) => {
    set((state) => {
      const tree = state.byProject[projectId];
      if (!tree) return state;
      const selected = new Set(tree.selected);
      if (selected.has(path)) selected.delete(path);
      else selected.add(path);
      return {
        byProject: {
          ...state.byProject,
          [projectId]: { ...tree, selected, selectionAnchor: path },
        },
      };
    });
  },

  selectRange: (projectId, fromPath, toPath) => {
    set((state) => {
      const tree = state.byProject[projectId];
      if (!tree) return state;
      // Range selection runs over the currently-visible rows, so closed dirs aren't
      // accidentally bulk-attached. Caller (PidFileTree) recomputes visibleRows already.
      const visible = flattenVisible(tree.nodes, tree.expanded);
      const fromIdx = visible.findIndex((n) => n.path === fromPath);
      const toIdx = visible.findIndex((n) => n.path === toPath);
      if (fromIdx < 0 || toIdx < 0) return state;
      const [lo, hi] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
      const next = new Set<string>();
      for (let i = lo; i <= hi; i++) {
        const node = visible[i];
        if (node) next.add(node.path);
      }
      return {
        byProject: {
          ...state.byProject,
          [projectId]: { ...tree, selected: next, selectionAnchor: toPath },
        },
      };
    });
  },

  clearSelection: (projectId) => {
    set((state) => {
      const tree = state.byProject[projectId];
      if (!tree) return state;
      return {
        byProject: {
          ...state.byProject,
          [projectId]: { ...tree, selected: new Set(), selectionAnchor: undefined },
        },
      };
    });
  },

  setFilter: (projectId, value) => {
    set((state) => {
      const tree = state.byProject[projectId];
      if (!tree) return state;
      const trimmed = value;
      const wasEmpty = tree.filter.length === 0;
      const willBeEmpty = trimmed.length === 0;
      // Snapshot expansion when transitioning empty → non-empty so we can restore on clear.
      let expandedBeforeFilter = tree.expandedBeforeFilter;
      if (wasEmpty && !willBeEmpty) expandedBeforeFilter = new Set(tree.expanded);
      // Restore on transition back to empty.
      let expanded = tree.expanded;
      if (!wasEmpty && willBeEmpty && tree.expandedBeforeFilter) {
        expanded = new Set(tree.expandedBeforeFilter);
        expandedBeforeFilter = undefined;
      }
      // users don't accidentally attach files that aren't in the filtered view anymore.
      return {
        byProject: {
          ...state.byProject,
          [projectId]: {
            ...tree,
            filter: trimmed,
            expanded,
            expandedBeforeFilter,
            selected: new Set(),
            selectionAnchor: undefined,
          },
        },
      };
    });
  },

  beginRename: (projectId, path) => {
    set((state) => {
      const tree = state.byProject[projectId];
      if (!tree) return state;
      return {
        byProject: {
          ...state.byProject,
          [projectId]: { ...tree, editing: { mode: "rename", path } },
        },
      };
    });
  },

  beginCreateFile: (projectId, parentDir) => {
    set((state) => {
      const tree = state.byProject[projectId];
      if (!tree) return state;
      const expanded = new Set(tree.expanded);
      // Ensure the parent dir is open so the draft row is visible.
      if (parentDir !== tree.root) expanded.add(parentDir);
      return {
        byProject: {
          ...state.byProject,
          [projectId]: {
            ...tree,
            expanded,
            editing: { mode: "create-file", parentDir },
          },
        },
      };
    });
  },

  beginCreateFolder: (projectId, parentDir) => {
    set((state) => {
      const tree = state.byProject[projectId];
      if (!tree) return state;
      const expanded = new Set(tree.expanded);
      if (parentDir !== tree.root) expanded.add(parentDir);
      return {
        byProject: {
          ...state.byProject,
          [projectId]: {
            ...tree,
            expanded,
            editing: { mode: "create-folder", parentDir },
          },
        },
      };
    });
  },

  cancelEditing: (projectId) => {
    set((state) => {
      const tree = state.byProject[projectId];
      if (!tree) return state;
      return {
        byProject: { ...state.byProject, [projectId]: { ...tree, editing: undefined } },
      };
    });
  },

  commitEditing: async (projectId, value) => {
    const tree = get().byProject[projectId];
    if (!tree?.editing) return;
    const client = useSessionsStore.getState().client;
    if (!client) return;
    const editing = tree.editing;
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      // Empty name silently cancels — matches VS Code behaviour, less punishing than an error.
      get().cancelEditing(projectId);
      return;
    }
    try {
      if (editing.mode === "rename") {
        await client.call("fs.rename", {
          projectId,
          fromPath: editing.path,
          toName: trimmed,
        });
      } else if (editing.mode === "create-file") {
        await client.call("fs.createFile", {
          projectId,
          parentDir: editing.parentDir,
          name: trimmed,
        });
      } else if (editing.mode === "create-folder") {
        await client.call("fs.createFolder", {
          projectId,
          parentDir: editing.parentDir,
          name: trimmed,
        });
      }
      get().cancelEditing(projectId);
      // The watcher fires `fs.tree.changed` for the new/renamed path, so we don't need to
      // refresh manually — the delta path is faster and avoids a full re-walk.
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, "Filesystem operation failed"));
      throw err;
    }
  },

  deletePaths: async (projectId, paths) => {
    if (paths.length === 0) return;
    const client = useSessionsStore.getState().client;
    if (!client) return;
    try {
      await client.call("fs.delete", { projectId, paths });
      // The fs watcher will emit removals; meanwhile clear selection for the trashed rows
      // so the UI doesn't flash "0 selected" for a moment.
      set((state) => {
        const tree = state.byProject[projectId];
        if (!tree) return state;
        return {
          byProject: {
            ...state.byProject,
            [projectId]: {
              ...tree,
              selected: prunePaths(tree.selected, paths),
              selectionAnchor: undefined,
            },
          },
        };
      });
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, "Failed to move files to trash"));
      throw err;
    }
  },
}));

function emptyTree(_projectId: string, opts: { loading?: boolean } = {}): ProjectTreeState {
  return {
    root: "",
    nodes: [],
    expanded: new Set(),
    selected: new Set(),
    selectionAnchor: undefined,
    filter: "",
    expandedBeforeFilter: undefined,
    editing: undefined,
    loading: opts.loading ?? false,
    error: undefined,
  };
}

/**
 * Returns the flattened list of currently-visible rows. Honours expansion state but NOT the
 * filter — fuse-matching is done in the visible-rows hook so this helper stays cheap for
 * range-selection. The depth is recorded so virtualized rows can render the indent.
 */
export interface VisibleRow {
  node: FsNode;
  depth: number;
  /** Project-relative path. */
  relPath: string;
  /** Absolute path. */
  path: string;
  /** Whether this row is itself an expanded directory. */
  isExpanded: boolean;
  /** Present iff this row is a synthetic "create file / folder" draft input spliced into
   * the visible list at the parent's child-depth. The renderer swaps to an inline-edit
   * input instead of the normal row content; the keyboard handler skips it. */
  draft?: { mode: "create-file" | "create-folder"; parentDir: string };
}

/**
 * Takes nodes + expanded set directly (rather than the whole `ProjectTreeState`) so callers
 * can memoize on (nodes, expanded) and skip recomputation when only selection / filter /
 * editing state changed. The hot path during an expand-toggle is just this walk.
 */
export function flattenVisible(nodes: FsNode[], expanded: Set<string>): VisibleRow[] {
  const out: VisibleRow[] = [];
  walk(nodes, 0);
  return out;

  function walk(items: FsNode[], depth: number): void {
    for (const node of items) {
      const isExpanded = node.type === "dir" && expanded.has(node.path);
      out.push({ node, depth, relPath: node.relPath, path: node.path, isExpanded });
      if (node.type === "dir" && isExpanded && node.children) {
        walk(node.children, depth + 1);
      }
    }
  }
}

function applyDelta(
  nodes: FsNode[],
  rootPath: string,
  added: FsNode[],
  removed: string[],
): FsNode[] {
  if (added.length === 0 && removed.length === 0) return nodes;
  // We always make a new array at the root level so the React tree-rebuild check passes;
  // sub-arrays are reused unless they actually changed.
  let next = nodes;
  if (removed.length > 0) {
    next = removeMany(next, removed);
  }
  if (added.length > 0) {
    next = insertMany(next, rootPath, added);
  }
  return next;
}

function removeMany(nodes: FsNode[], paths: string[]): FsNode[] {
  const set = new Set(paths);
  const filtered: FsNode[] = [];
  let changed = false;
  for (const n of nodes) {
    if (set.has(n.path)) {
      changed = true;
      continue;
    }
    if (n.type === "dir" && n.children) {
      const nextChildren = removeMany(n.children, paths);
      if (nextChildren !== n.children) {
        changed = true;
        filtered.push({ ...n, children: nextChildren });
        continue;
      }
    }
    filtered.push(n);
  }
  return changed ? filtered : nodes;
}

function insertMany(nodes: FsNode[], rootPath: string, added: FsNode[]): FsNode[] {
  let current = nodes;
  for (const node of added) {
    current = insertOne(current, rootPath, node);
  }
  return current;
}

function insertOne(nodes: FsNode[], rootPath: string, node: FsNode): FsNode[] {
  const rootPosix = rootPath.replace(/\\/g, "/");
  if (!node.path.startsWith(`${rootPosix}/`)) return nodes;
  const remainder = node.path.slice(rootPosix.length + 1);
  const parts = remainder.split("/");

  if (parts.length === 1) {
    if (nodes.some((n) => n.path === node.path)) return nodes;
    return sorted([...nodes, node]);
  }
  // Descend into the matching directory branch, then splice in.
  const head = parts[0];
  if (!head) return nodes;
  let mutated = false;
  const result = nodes.map((n) => {
    if (n.type === "dir" && n.name === head) {
      const childAdded = insertOne(n.children ?? [], n.path, node);
      if (childAdded !== n.children) {
        mutated = true;
        return { ...n, children: childAdded };
      }
    }
    return n;
  });
  return mutated ? result : nodes;
}

function sorted(nodes: FsNode[]): FsNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
}

function prunePaths(set: Set<string>, removed: string[]): Set<string> {
  if (set.size === 0) return set;
  const removedSet = new Set(removed);
  const next = new Set<string>();
  for (const p of set) {
    if (removedSet.has(p)) continue;
    // Removing a directory implicitly removes all paths under it.
    let dropped = false;
    for (const r of removed) {
      if (p.startsWith(`${r}/`)) {
        dropped = true;
        break;
      }
    }
    if (!dropped) next.add(p);
  }
  return next;
}
