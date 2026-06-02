import type { FsNode } from "@pi-deck/core/fs/types.js";
import { create } from "zustand";
import { humanizeError } from "../../lib/format/humanize-error.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";

/**
 * Per-project filesystem snapshot for the files tab. Since the migration to `@pierre/trees`,
 * the renderer's tree owns selection / expansion / search / editing internally — this store
 * is purely the data feed: the host walk result plus the watcher-driven deltas. The component
 * flattens `nodes` into the path list it hands to the Pierre model.
 */
export interface ProjectTreeState {
  root: string;
  nodes: FsNode[];
  /** Walk loading flag. */
  loading: boolean;
  /** Last error message; rendered in the empty-state component. */
  error: string | undefined;
}

interface FileTreeStoreState {
  /** Per-project state. */
  byProject: Record<string, ProjectTreeState | undefined>;

  ensureTree: (projectId: string) => Promise<void>;
  refreshTree: (projectId: string) => Promise<void>;
  /** Watcher-driven delta applied from the event router. */
  applyTreeChanged: (projectId: string, added: FsNode[], removed: string[]) => void;
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
            : emptyTree({ loading: true }),
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
                ...(existing ?? emptyTree()),
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
                ...(existing ?? emptyTree()),
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
      const nodes = applyDelta(existing.nodes, existing.root, added, removed);
      if (nodes === existing.nodes) return state;
      return {
        byProject: {
          ...state.byProject,
          [projectId]: { ...existing, nodes },
        },
      };
    });
  },
}));

function emptyTree(opts: { loading?: boolean } = {}): ProjectTreeState {
  return {
    root: "",
    nodes: [],
    loading: opts.loading ?? false,
    error: undefined,
  };
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
