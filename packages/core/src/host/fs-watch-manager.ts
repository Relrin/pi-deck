import { EventEmitter } from "node:events";
import { type FsNode, type FsWatchHandle, walkProject, watchProject } from "../fs/index.js";
import { EVENT_FS_TREE_CHANGED, type EventTopic } from "../protocol/events.js";
import type { MetadataStore } from "./metadata-store.js";

interface CachedTree {
  root: string;
  nodes: FsNode[];
  handle: FsWatchHandle;
}

export type FsWatchEvents = {
  event: [topic: EventTopic, payload: unknown];
};

/**
 * Maximum number of project watchers we keep alive at once. Each watcher attaches OS-level
 * file watches on every (non-ignored) directory in the project tree — on Linux that's
 * `inotify` slots, which have a system-wide limit. Capping the manager prevents pi-deck
 * from blowing through those quotas when the user has many projects opened across sessions.
 *
 * When the cap is exceeded the LRU entry is closed; its in-memory tree cache is dropped too.
 * The renderer's per-project store keeps its own copy of the tree, so the user still sees
 * data immediately on the next visit; the host walks again on the next `fs.tree` call and
 * the renderer reconciles via the standard event flow.
 *
 * Running up to 5 instances would give enough headroom, that covers "active + recently
 * active" without growing the OS-watch budget unboundedly.
 */
const MAX_ACTIVE_WATCHERS = 5;

/**
 * One walker + watcher per opened project. The first `getOrLoad` call walks the project root
 * and starts a chokidar watch; subsequent calls return the cached snapshot. The watcher emits
 * coalesced add/remove deltas via the host's event broadcaster so the renderer can patch its
 * tree without round-tripping back to `fs.tree`.
 *
 * Watchers are bounded LRU (see `MAX_ACTIVE_WATCHERS`). Each touch (`getOrLoad`, or an
 * external `touch(projectId)` from session-switch logic) moves the project to the front of
 * the LRU. When the cap is exceeded we evict the oldest entry; the renderer can re-load it
 * on demand from its own cached snapshot.
 */
export class FsWatchManager extends EventEmitter<FsWatchEvents> {
  private readonly entries = new Map<string, CachedTree>();
  private readonly inFlight = new Map<string, Promise<CachedTree>>();
  /** Project IDs, most-recently-used first. Mirrors `entries` membership. */
  private readonly lru: string[] = [];

  constructor(private readonly metadataStore: MetadataStore) {
    super();
  }

  /** Returns the cached snapshot, walking the project lazily if it hasn't been opened yet. */
  async getOrLoad(projectId: string): Promise<{ root: string; nodes: FsNode[] }> {
    const cached = this.entries.get(projectId);
    if (cached) {
      this.touch(projectId);
      return { root: cached.root, nodes: cached.nodes };
    }
    const entry = await this.loadInternal(projectId);
    return { root: entry.root, nodes: entry.nodes };
  }

  /**
   * Mark this project as recently-used without forcing a walk. Useful when the renderer
   * switches sessions but doesn't yet need the tree — keeps the watcher alive across an
   * eviction wave that would otherwise drop it.
   */
  touch(projectId: string): void {
    if (!this.entries.has(projectId)) return;
    const idx = this.lru.indexOf(projectId);
    if (idx > 0) {
      this.lru.splice(idx, 1);
      this.lru.unshift(projectId);
    }
  }

  async stop(projectId: string): Promise<void> {
    const entry = this.entries.get(projectId);
    if (!entry) return;
    this.entries.delete(projectId);
    const idx = this.lru.indexOf(projectId);
    if (idx >= 0) this.lru.splice(idx, 1);
    await entry.handle.close();
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.entries.values()].map((e) => e.handle.close()));
    this.entries.clear();
    this.lru.length = 0;
  }

  private async loadInternal(projectId: string): Promise<CachedTree> {
    const inFlight = this.inFlight.get(projectId);
    if (inFlight) return inFlight;

    const promise = (async () => {
      const project = await this.metadataStore.readProject(projectId);
      if (!project) throw new Error(`Project ${projectId} not found`);
      const root = project.path;
      // Walk first so the renderer gets data ASAP, then attach the chokidar watcher in
      // parallel with the renderer's first paint. `watchProject` is now async because it
      // preloads the ignore matcher before bootstrapping chokidar.
      const nodes = await walkProject(root);
      const handle = await watchProject(root, (delta) => {
        this.applyDelta(projectId, delta.added, delta.removed);
        this.emit("event", EVENT_FS_TREE_CHANGED, {
          projectId,
          added: delta.added,
          removed: delta.removed,
        });
      });
      const entry: CachedTree = { root, nodes, handle };
      this.entries.set(projectId, entry);
      this.lru.unshift(projectId);
      // Evict the LRU tail BEFORE returning so the cap holds at all times. Failures here
      // are logged but don't fail the load — the caller already has its tree.
      await this.enforceCap();
      return entry;
    })();
    this.inFlight.set(projectId, promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(projectId);
    }
  }

  private async enforceCap(): Promise<void> {
    while (this.lru.length > MAX_ACTIVE_WATCHERS) {
      const victim = this.lru.pop();
      if (!victim) break;
      const entry = this.entries.get(victim);
      if (!entry) continue;
      this.entries.delete(victim);
      try {
        await entry.handle.close();
      } catch {
        // Best-effort — even if close() failed, we've already dropped the cache.
      }
    }
  }

  /**
   * Apply a watcher delta to the cached in-memory tree so subsequent `getOrLoad` calls see
   * a fresh snapshot without re-walking. The tree is a small mutation point — splicing
   * nodes into the right parent by walking the `added.path` ancestor chain.
   */
  private applyDelta(projectId: string, added: FsNode[], removed: string[]): void {
    const entry = this.entries.get(projectId);
    if (!entry) return;

    for (const path of removed) {
      removeNode(entry.nodes, path);
    }
    for (const node of added) {
      insertNode(entry.nodes, entry.root, node);
    }
  }
}

function removeNode(nodes: FsNode[], absPath: string): boolean {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!n) continue;
    if (n.path === absPath) {
      nodes.splice(i, 1);
      return true;
    }
    if (n.type === "dir" && n.children && absPath.startsWith(`${n.path}/`)) {
      if (removeNode(n.children, absPath)) return true;
    }
  }
  return false;
}

function insertNode(rootChildren: FsNode[], rootPath: string, node: FsNode): void {
  // Strip the project root prefix to find the parent directory chain.
  const rootPosix = rootPath.replace(/\\/g, "/");
  if (!node.path.startsWith(`${rootPosix}/`)) return;
  const remainder = node.path.slice(rootPosix.length + 1);
  const parts = remainder.split("/");
  let bucket = rootChildren;
  for (let i = 0; i < parts.length - 1; i++) {
    const segment = parts[i];
    if (!segment) continue;
    const next = bucket.find((c) => c.type === "dir" && c.name === segment);
    if (!next) {
      // Parent dir hasn't been walked yet — likely because the watcher fired before
      // `walkProject` finished. Drop the add; the eventual re-walk on `getOrLoad` will
      // surface it.
      return;
    }
    if (!next.children) next.children = [];
    bucket = next.children;
  }
  // Skip if we already have this path (e.g. our own create echoing back).
  if (bucket.some((c) => c.path === node.path)) return;
  // Maintain folders-first, alpha sort so the inserted row lands in the visual right spot.
  bucket.push(node);
  bucket.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
}
