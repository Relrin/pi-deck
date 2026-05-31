import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { GitCommandError, runGit } from "./runner.js";

/**
 * Revert one repo-relative path to the state captured by `baseline`, where `baseline`
 * is either `"HEAD"` or a `git stash create` SHA from `snapshot.ts`.
 *
 * Three cases the review flow needs:
 *  - file exists in baseline → `git checkout <baseline> -- <path>` (covers
 *    tracked-modified by the agent, and tracked-deleted by the agent — checkout puts
 *    the file back in either case).
 *  - file does not exist in baseline → unlink from disk (agent-created file the user
 *    rejected). Missing-on-disk is tolerated so per-file + reject-all can race safely.
 *
 * The "file is untracked-but-existed at baseline" edge case is not handled here — see
 * snapshot.ts for the documented limitation.
 */
export async function revertPath(
  root: string,
  path: string,
  baseline: "HEAD" | string,
): Promise<void> {
  const ref = baseline === "HEAD" ? "HEAD" : baseline;
  if (await existsInBaseline(root, path, ref)) {
    await runGit(root, ["checkout", ref, "--", path]);
    return;
  }
  try {
    await unlink(resolve(root, path));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return;
    throw err;
  }
}

async function existsInBaseline(root: string, path: string, ref: string): Promise<boolean> {
  try {
    // `git cat-file -e` exits 0 when the blob exists, non-zero otherwise. Quieter than
    // `git show` for the existence-only check we need.
    await runGit(root, ["cat-file", "-e", `${ref}:${path}`]);
    return true;
  } catch (err) {
    if (err instanceof GitCommandError) return false;
    throw err;
  }
}
