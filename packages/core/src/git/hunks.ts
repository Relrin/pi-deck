import { GitCommandError, NotARepoError, runGit } from "./runner.js";
import type { GitHunk } from "./types.js";

/**
 * Per-file diff hunks vs HEAD, keyed by repo-relative path. The renderer never needs the
 * hunk *content* (only line ranges and +/- counts to draw "hunk 1/3 · L12–L20" rows), so
 * we run `git diff --unified=0` and parse just the `@@` headers.
 *
 * Untracked files don't appear in `git diff HEAD` and will have no entry in the map; the
 * UI shows their file row without children. Pre-initial-commit fallback mirrors the
 * numstat path in status.ts (`git diff --cached`).
 */
export async function getDiffHunks(root: string): Promise<Map<string, GitHunk[]>> {
  try {
    return await readHunks(root, ["diff", "HEAD", "--unified=0", "--no-color", "--no-renames"]);
  } catch (err) {
    if (err instanceof NotARepoError) return new Map();
    if (err instanceof GitCommandError) {
      try {
        return await readHunks(root, [
          "diff",
          "--cached",
          "--unified=0",
          "--no-color",
          "--no-renames",
        ]);
      } catch {
        return new Map();
      }
    }
    throw err;
  }
}

async function readHunks(root: string, args: string[]): Promise<Map<string, GitHunk[]>> {
  const { stdout } = await runGit(root, args);
  return parseHunks(stdout);
}

const HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Parse the textual output of `git diff --unified=0` into `path -> hunks`. Exported for
 * the unit tests; the production callers go through `getDiffHunks`.
 */
export function parseHunks(stdout: string): Map<string, GitHunk[]> {
  const out = new Map<string, GitHunk[]>();
  let currentList: GitHunk[] | undefined;

  for (const line of stdout.split(/\r?\n/)) {
    // `+++ b/<path>` is the canonical "new file" path emitted for additions and
    // modifications. For deletions git prints `+++ /dev/null` and the path lives on the
    // preceding `--- a/<path>` line, so we also key off that.
    if (line.startsWith("+++ b/")) {
      currentList = ensureList(out, line.slice(6));
      continue;
    }
    if (line.startsWith("--- a/")) {
      currentList = ensureList(out, line.slice(6));
      continue;
    }
    const m = HEADER_RE.exec(line);
    if (m && currentList) {
      const oldStart = Number(m[1]);
      const oldLines = m[2] === undefined ? 1 : Number(m[2]);
      const newStart = Number(m[3]);
      const newLines = m[4] === undefined ? 1 : Number(m[4]);
      currentList.push({
        oldStart,
        oldLines,
        newStart,
        newLines,
        add: newLines,
        del: oldLines,
      });
    }
  }
  return out;
}

function ensureList(out: Map<string, GitHunk[]>, path: string): GitHunk[] {
  const existing = out.get(path);
  if (existing) return existing;
  const fresh: GitHunk[] = [];
  out.set(path, fresh);
  return fresh;
}
