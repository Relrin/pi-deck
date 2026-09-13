import { comparePaths } from "@pi-deck/core/fs/collation.js";
import type { GitChange } from "@pi-deck/core/git/types.js";

/**
 * Tracked changed files (those with a HEAD diff) in natural path order — the set the diff
 * screen's compare-previous/next-file actions cycle through. Untracked files (`?`) have no
 * baseline to diff against, so they're excluded.
 */
export function orderedDiffFiles(changes: readonly GitChange[] | undefined): string[] {
  return (changes ?? [])
    .filter((c) => c.status !== "?")
    .map((c) => c.path)
    .sort(comparePaths);
}

/**
 * Path of the previous (`dir = -1`) or next (`dir = 1`) changed file relative to `current`.
 * Returns undefined at the ends (no wrap) or when `current` isn't in the list.
 */
export function neighborDiffFile(
  files: readonly string[],
  current: string,
  dir: -1 | 1,
): string | undefined {
  const idx = files.indexOf(current);
  if (idx < 0) return undefined;
  const next = idx + dir;
  return next >= 0 && next < files.length ? files[next] : undefined;
}
