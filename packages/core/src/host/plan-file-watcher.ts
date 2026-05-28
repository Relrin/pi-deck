import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { dirname, posix, resolve, sep } from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { EVENT_PLAN_FILE_CHANGED, type EventTopic } from "../protocol/events.js";

/**
 * Per-session subdirectory under the project root where plan-mode persists its plan markdown.
 * Mirrors the convention announced in `composePlanPrompt` — keep both call sites in sync.
 */
const PLAN_DIR_REL = ".pi-deck/plans";

export type PlanFileWatcherEvents = {
  event: [topic: EventTopic, payload: unknown];
};

interface ActiveWatcher {
  sessionId: string;
  projectPath: string;
  /** Absolute, OS-native path of the watched file. */
  absPath: string;
  /** POSIX-normalised variant of `absPath`, used in event payloads. */
  posixPath: string;
  watcher: FSWatcher;
  debounce: NodeJS.Timeout | undefined;
}

/**
 * Watches each active session's plan file at `${projectPath}/.pi-deck/plans/<sessionId>.md` and
 * pushes its content to the renderer on every add/change/unlink event. Compared to the broader
 * `FsWatchManager`, this watcher:
 *
 * 1. **Reacts to content-only changes** — the plan file is overwritten in place by the agent's
 *    write tool every turn. The shared file-tree watcher deliberately ignores `change` events
 *    because the *tree shape* doesn't move; this watcher emits content on every change.
 * 2. **Survives `.gitignore`** — projects commonly add `.pi-deck/` to `.gitignore`, which would
 *    suppress fs.tree events for the plan file. This watcher doesn't consult ignore rules.
 * 3. **Cheap** — one chokidar instance per active session (cap matches the LRU window of active
 *    sessions in practice, ~handful). Each instance scopes a single file path, not a tree.
 *
 * The watcher is started lazily — either via an explicit `ensureWatcher` call (used when the
 * renderer first opens the plan panel) or automatically when the session enters plan mode.
 * Sessions evict their watcher on `stop(sessionId)` (called from session deactivate/delete) and
 * on shutdown.
 */
export class PlanFileWatcher extends EventEmitter<PlanFileWatcherEvents> {
  private readonly active = new Map<string, ActiveWatcher>();

  /**
   * Resolve the absolute plan-file path for a session. Exposed so callers (e.g. the
   * `plan.file.read` command handler) don't have to duplicate the join.
   */
  static planFilePath(projectPath: string, sessionId: string): string {
    return resolve(projectPath, PLAN_DIR_REL, `${sessionId}.md`);
  }

  /**
   * Read the plan file's current content. Returns `null` when the file does not exist so the
   * renderer can render an empty-state without a separate "file is missing" error path.
   */
  static async readPlanFile(absPath: string): Promise<string | null> {
    try {
      return await readFile(absPath, "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return null;
      throw err;
    }
  }

  /**
   * Start a watcher for `(sessionId, projectPath)` if one isn't running yet. Idempotent —
   * repeated calls return the same handle. Emits an initial `plan.file.changed` event with the
   * current content (or `null`) so the renderer paints immediately rather than waiting for the
   * next filesystem event.
   */
  ensure(sessionId: string, projectPath: string): void {
    if (this.active.has(sessionId)) return;
    const absPath = PlanFileWatcher.planFilePath(projectPath, sessionId);
    const posixPath = toPosix(absPath);

    // Watch the containing directory rather than the file itself: chokidar treats a watched
    // file that doesn't exist yet as a permanent miss, but watching the directory lets us see
    // the file *appear* (the common case — the agent creates the plan file mid-turn).
    const watchTarget = dirname(absPath);
    const watcher = chokidar.watch(watchTarget, {
      ignoreInitial: true,
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });

    const entry: ActiveWatcher = {
      sessionId,
      projectPath,
      absPath,
      posixPath,
      watcher,
      debounce: undefined,
    };
    this.active.set(sessionId, entry);

    const trigger = (eventPath: string) => {
      // Filter — chokidar emits for every file in `.pi-deck/plans/`; we only care about *this*
      // session's plan file. Compare in POSIX form because chokidar normalises event paths to
      // forward slashes even on Windows, while `resolve()` keeps native separators.
      if (toPosix(resolve(eventPath)) !== posixPath) return;
      if (entry.debounce) clearTimeout(entry.debounce);
      entry.debounce = setTimeout(() => {
        entry.debounce = undefined;
        void this.emitCurrent(entry);
      }, 100);
    };

    watcher.on("add", trigger);
    watcher.on("change", trigger);
    watcher.on("unlink", trigger);
    watcher.on("error", () => {
      // Best-effort — swallow chokidar errors. The next event will re-prime the stream.
    });

    // Prime the renderer with current state ONCE chokidar finishes its bootstrap. Emitting
    // before `ready` would race tests (and real callers) into thinking the watcher is live
    // while the OS-level inotify/ReadDirectoryChangesW handle hasn't attached yet — the next
    // write would be silently dropped on Windows. The `readPlanFile` call handles ENOENT by
    // returning null, so the initial emit fires even when the file hasn't been created yet.
    watcher.once("ready", () => {
      void this.emitCurrent(entry);
    });
  }

  /** Stop and forget the watcher for a session (if any). */
  async stop(sessionId: string): Promise<void> {
    const entry = this.active.get(sessionId);
    if (!entry) return;
    this.active.delete(sessionId);
    if (entry.debounce) clearTimeout(entry.debounce);
    try {
      await entry.watcher.close();
    } catch {
      // Best-effort.
    }
  }

  async shutdown(): Promise<void> {
    await Promise.all(
      [...this.active.values()].map(async (entry) => {
        if (entry.debounce) clearTimeout(entry.debounce);
        try {
          await entry.watcher.close();
        } catch {
          // Best-effort.
        }
      }),
    );
    this.active.clear();
  }

  /**
   * Read the file and broadcast its current state. Errors other than ENOENT are swallowed so
   * a transient EBUSY on Windows doesn't kill the watcher; the next change event re-tries.
   */
  private async emitCurrent(entry: ActiveWatcher): Promise<void> {
    let content: string | null;
    try {
      content = await PlanFileWatcher.readPlanFile(entry.absPath);
    } catch {
      return;
    }
    this.emit("event", EVENT_PLAN_FILE_CHANGED, {
      sessionId: entry.sessionId,
      path: entry.posixPath,
      content,
    });
  }
}

function toPosix(p: string): string {
  if (sep === "/") return p;
  return p.split(sep).join(posix.sep);
}
