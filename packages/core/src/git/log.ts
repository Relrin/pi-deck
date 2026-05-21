import { GitCommandError, NotARepoError, runGit } from "./runner.js";
import type { GitCommit } from "./types.js";

// Field separator is ASCII Unit Separator (0x1F) — won't collide with subject text or names.
const SEP = "\x1f";
const FORMAT = ["%H", "%h", "%s", "%an", "%ae", "%aI", "%cI"].join(SEP);

/**
 * Returns the last `limit` commits reachable from HEAD, newest first. Returns `[]` for a
 * brand-new repo with no commits yet (HEAD resolves but `log` exits non-zero) and for
 * non-repos.
 */
export async function getRecentCommits(root: string, limit = 20): Promise<GitCommit[]> {
  if (limit <= 0) return [];
  try {
    const { stdout } = await runGit(root, ["log", `-n${limit}`, `--format=${FORMAT}`]);
    return parseLog(stdout);
  } catch (err) {
    if (err instanceof NotARepoError) return [];
    if (err instanceof GitCommandError) return [];
    throw err;
  }
}

function parseLog(stdout: string): GitCommit[] {
  const out: GitCommit[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line) continue;
    const parts = line.split(SEP);
    if (parts.length < 7) continue;
    out.push({
      sha: parts[0] ?? "",
      shortSha: parts[1] ?? "",
      subject: parts[2] ?? "",
      authorName: parts[3] ?? "",
      authorEmail: parts[4] ?? "",
      authoredAt: parts[5] ?? "",
      committedAt: parts[6] ?? "",
    });
  }
  return out;
}
