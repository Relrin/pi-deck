import { NotARepoError, runGit } from "./runner.js";

export interface DetectRepoResult {
  /** Absolute path to the working-tree root from `rev-parse --show-toplevel`. */
  root: string;
}

/**
 * Returns the repo root for `path`, or `null` when `path` is not inside a working tree.
 * Does NOT throw on non-repo paths — the caller chooses how to react.
 */
export async function detectRepo(path: string): Promise<DetectRepoResult | null> {
  try {
    const { stdout } = await runGit(path, ["rev-parse", "--show-toplevel"]);
    const root = stdout.trim();
    return root ? { root } : null;
  } catch (err) {
    if (err instanceof NotARepoError) return null;
    throw err;
  }
}
