import type { Stats } from "node:fs";
import { stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { type FSWatcher, watch } from "chokidar";
import type { Ignore } from "ignore";
import { buildIgnoreFromRoot } from "./ignore-loader.js";
import type { FsNode } from "./types.js";

export interface FsWatchHandle {
  close: () => Promise<void>;
}

export interface FsWatchDelta {
  /** Newly visible nodes that should be inserted into the tree. */
  added: FsNode[];
  /** Absolute paths (POSIX) that no longer exist or became ignored. */
  removed: string[];
}

/**
 * Watches a project root for filesystem changes and emits coalesced add/remove deltas
 * after debouncing.
 *
 * Two layers of ignore filtering:
 *
 * 1. **Initial-scan filter** — the `.gitignore` matcher is loaded *before* `chokidar.watch()`
 *    runs, then passed in as the `ignored` predicate. Chokidar consults it during its
 *    bootstrap directory walk and skips ignored subtrees ENTIRELY (no `readdir`, no OS file
 *    watches attached). This is the big win for monorepos with multi-GB `node_modules/` —
 *    without it, chokidar walks every nested package directory just to filter the events
 *    out at the event-handler level.
 *
 * 2. **Event-time filter** — when the `.gitignore` itself mutates we don't restart the
 *    watcher (chokidar v4 doesn't let us swap the predicate live), so the in-handler
 *    matcher catches paths whose ignore-status flipped after the initial scan.
 *
 * Deltas are intentionally coarse — we don't try to detect renames as a single op (chokidar
 * emits them as unlink + add) because the tree shape doesn't care.
 */
export async function watchProject(
  root: string,
  onChange: (delta: FsWatchDelta) => void,
): Promise<FsWatchHandle> {
  const absRoot = resolve(root);

  // Preload the matcher before kicking off the watcher so chokidar's initial scan honours
  // .gitignore. The post-bootstrap event handler refreshes it when `.gitignore` mutates.
  let matcher: Ignore = await buildIgnoreFromRoot(absRoot);

  const refreshMatcher = async () => {
    try {
      matcher = await buildIgnoreFromRoot(absRoot);
    } catch {
      // Non-fatal — keep the previous matcher.
    }
  };

  const pendingAdded = new Map<string, FsNode>();
  const pendingRemoved = new Set<string>();
  let flushTimer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    flushTimer = undefined;
    if (pendingAdded.size === 0 && pendingRemoved.size === 0) return;
    const delta: FsWatchDelta = {
      added: [...pendingAdded.values()],
      removed: [...pendingRemoved],
    };
    pendingAdded.clear();
    pendingRemoved.clear();
    onChange(delta);
  };
  const schedule = () => {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 100);
  };

  /**
   * Chokidar `ignored` predicate. Sync, called for every path during initial scan and on
   * every event. We always allow the root itself, then consult the `.gitignore` matcher.
   *
   * The optional `stats` argument is chokidar's `MatchFunction` second arg (typed as
   * `node:fs.Stats`). When present we know whether the path is a directory and can match
   * `foo/` vs `foo` correctly; when absent (first call before stat) we treat as file.
   * The `ignore` package handles both forms gracefully.
   */
  const isIgnored = (p: string, stats?: Stats): boolean => {
    if (p === absRoot) return false;
    const rel = relative(absRoot, p);
    if (rel === "" || rel.startsWith("..")) return false;
    const relPosix = toPosix(rel);
    // .git is always ignored — independent of any user-level rules.
    if (relPosix === ".git" || relPosix.startsWith(".git/")) return true;
    const isDir = stats?.isDirectory() ?? false;
    const key = isDir ? `${relPosix}/` : relPosix;
    return matcher.ignores(key);
  };

  const watcher: FSWatcher = watch(absRoot, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
    // The predicate skips not just the path but every descendant — so `node_modules/` is
    // entered into chokidar's tree once, returned `true`, and never recursed into. That's
    // what makes the bootstrap fast on big monorepos.
    ignored: isIgnored,
  });

  watcher.on("all", (event, filePath) => {
    void (async () => {
      const abs = resolve(filePath);
      const rel = relative(absRoot, abs);
      if (rel.startsWith("..") || rel === "") return;
      const relPosix = toPosix(rel);

      // A `.gitignore` change can flip the visibility of arbitrary siblings; refresh the
      // matcher so subsequent events are filtered correctly. We don't try to re-emit the
      // visibility-changed nodes — the renderer's tree may lag for already-walked rows
      // until the next manual refresh, which is acceptable.
      if (filePath.endsWith(".gitignore") || filePath.endsWith(`info${sep}exclude`)) {
        await refreshMatcher();
        return;
      }

      if (event === "unlink" || event === "unlinkDir") {
        pendingAdded.delete(toPosix(abs));
        pendingRemoved.add(toPosix(abs));
        schedule();
        return;
      }
      if (event === "add" || event === "addDir") {
        // Defensive: chokidar already called `isIgnored` during scanning, but a path that
        // appeared AFTER the bootstrap might match a deeper-level `.gitignore` we don't see
        // at the root. Re-check here so we don't pollute the renderer's tree with junk.
        const isDir = event === "addDir";
        const matchKey = isDir ? `${relPosix}/` : relPosix;
        if (matcher.ignores(matchKey)) return;
        let typeIsDir = isDir;
        if (!isDir) {
          try {
            const s = await stat(abs);
            typeIsDir = s.isDirectory();
          } catch {
            return;
          }
        }
        const node: FsNode = {
          path: toPosix(abs),
          name: abs.split(/[\\/]/).at(-1) ?? abs,
          type: typeIsDir ? "dir" : "file",
          relPath: relPosix,
        };
        if (typeIsDir) node.children = [];
        pendingRemoved.delete(node.path);
        pendingAdded.set(node.path, node);
        schedule();
      }
      // `change` events don't change the tree shape — ignored.
    })();
  });

  watcher.on("error", () => {
    // Best-effort: swallow watcher errors so a transient EBUSY on Windows doesn't kill the
    // whole watch. The next fs event will resume the stream.
  });

  return {
    close: async () => {
      if (flushTimer) clearTimeout(flushTimer);
      await watcher.close();
    },
  };
}

function toPosix(p: string): string {
  if (sep === "/") return p;
  return p.split(sep).join("/");
}
