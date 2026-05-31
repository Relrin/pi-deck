import { runGit } from "./runner.js";

/**
 * Capture a snapshot of the working tree without touching the index or the stash log.
 *
 * `git stash create` writes a new commit object representing the working-tree + index
 * state and prints its SHA to stdout, leaving everything else untouched. Unlike
 * `git stash push` it does not modify the working tree, does not advance refs/stash,
 * and produces a stable commit hash we can `git checkout … -- <path>` against later.
 *
 * Returns `null` when there is nothing to stash — the canonical "baseline = HEAD" case
 * for a clean working tree at turn start.
 *
 * Limitation: `git stash create` captures *tracked* paths only. Untracked files are not
 * part of the resulting commit. Callers that need to revert agent edits to an
 * untracked-but-pre-existing file need a separate side-channel snapshot.
 */
export async function snapshotForTurn(root: string): Promise<string | null> {
  const { stdout } = await runGit(root, ["stash", "create"]);
  const sha = stdout.trim();
  return sha.length > 0 ? sha : null;
}
