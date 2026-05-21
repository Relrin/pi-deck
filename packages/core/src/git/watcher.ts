import { join } from "node:path";
import { type FSWatcher, watch } from "chokidar";

export interface WatchHandle {
  close: () => Promise<void>;
}

/**
 * Watches the bits of `.git/` that matter for status changes (`HEAD`, `index`, `refs/`) plus
 * a 5-second polling fallback for cases chokidar misses (e.g. networked filesystems and
 * working-tree edits that don't touch the index). Returns a handle so the caller can dispose
 * cleanly when the project closes.
 *
 * Calls to `onChange` are coalesced via a 150ms debounce — a single `git add` typically fires
 * 3–5 fs events otherwise.
 */
export function watchRepo(root: string, onChange: () => void): WatchHandle {
  const trigger = makeDebounce(150, onChange);
  const gitDir = join(root, ".git");
  const watcher: FSWatcher = watch(
    [join(gitDir, "HEAD"), join(gitDir, "index"), join(gitDir, "refs")],
    {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: false,
    },
  );
  watcher.on("all", () => trigger());
  watcher.on("error", () => {
    // Swallow — the polling fallback below covers it.
  });

  const interval = setInterval(() => onChange(), 5000);

  return {
    close: async () => {
      clearInterval(interval);
      await watcher.close();
    },
  };
}

function makeDebounce(ms: number, fn: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn();
    }, ms);
  };
}
