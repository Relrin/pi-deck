import { EventEmitter } from "node:events";
import { type GitStatus, getStatus, type WatchHandle, watchRepo } from "../git/index.js";
import { EVENT_GIT_STATUS_CHANGED, type EventTopic } from "../protocol/events.js";
import type { MetadataStore } from "./metadata-store.js";

interface WatcherEntry {
  handle: WatchHandle;
  root: string;
  /** Cached last-known status so re-subscribers can hydrate without a fresh git call. */
  status: GitStatus;
}

export type GitWatchEvents = {
  event: [topic: EventTopic, payload: unknown];
};

/**
 * Tracks one git watcher per opened project. The first `getOrLoad` for a project triggers a
 * `getStatus` call and (if the path is a repo) spins up a chokidar watcher; subsequent calls
 * reuse the cached status. Watcher fs/poll triggers re-run `getStatus` and broadcast a
 * `git.status.changed` event so the renderer can refresh without an extra round trip.
 *
 * Watchers stay alive until `stop(projectId)` or `shutdown()`. We deliberately don't tie the
 * watcher lifetime to session activation because the git tab is per-project, not per-session.
 */
export class GitWatchManager extends EventEmitter<GitWatchEvents> {
  private readonly entries = new Map<string, WatcherEntry>();
  private readonly inFlight = new Set<string>();

  constructor(private readonly metadataStore: MetadataStore) {
    super();
  }

  async getOrLoad(projectId: string): Promise<GitStatus> {
    const existing = this.entries.get(projectId);
    if (existing) return existing.status;
    return this.refresh(projectId, { emit: false });
  }

  async stop(projectId: string): Promise<void> {
    const entry = this.entries.get(projectId);
    if (!entry) return;
    this.entries.delete(projectId);
    await entry.handle.close();
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.entries.values()].map((e) => e.handle.close()));
    this.entries.clear();
  }

  /**
   * Re-reads `getStatus(root)` for the project. When `emit: true`, broadcasts the resulting
   * status under `git.status.changed`. Dedupes concurrent calls so a watcher storm collapses
   * to a single git invocation.
   */
  private async refresh(projectId: string, opts: { emit: boolean }): Promise<GitStatus> {
    if (this.inFlight.has(projectId)) {
      // A refresh is already in flight; wait for it indirectly by re-checking the cache after
      // a microtask. In practice the watcher debounce + this guard prevent overlapping calls.
      const cached = this.entries.get(projectId)?.status;
      if (cached) return cached;
    }
    this.inFlight.add(projectId);
    try {
      const project = await this.metadataStore.readProject(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }
      const status = await getStatus(project.path);
      const prev = this.entries.get(projectId);
      if (status.isRepo && status.root) {
        if (prev) {
          prev.status = status;
        } else {
          const handle = watchRepo(status.root, () => {
            void this.refresh(projectId, { emit: true });
          });
          this.entries.set(projectId, { handle, root: status.root, status });
        }
      } else if (prev) {
        // Repo was deleted under us — tear the watcher down.
        await prev.handle.close();
        this.entries.delete(projectId);
      }
      if (opts.emit) {
        this.emit("event", EVENT_GIT_STATUS_CHANGED, { projectId, status });
      }
      return status;
    } finally {
      this.inFlight.delete(projectId);
    }
  }
}
