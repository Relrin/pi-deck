import { runGit } from "./runner.js";

/**
 * Initialises a git repo at `path`, defaulting the initial branch to `main` so the result
 * is consistent regardless of the user's global `init.defaultBranch` setting. Idempotent —
 * running on an existing repo reinitialises its `.git/` without losing history.
 */
export async function initRepo(path: string): Promise<void> {
  await runGit(path, ["init", "--initial-branch=main"]);
}
