import { GitCommandError, NotARepoError, runGit } from "./runner.js";

export interface ProjectFileEntry {
  path: string;
  kind: "file";
}

/**
 * Enumerates every tracked + untracked-but-not-ignored file in the working tree, capped at
 * `limit`. We lean on `git ls-files --cached --others --exclude-standard` so .gitignore is
 * honoured without us re-implementing pattern matching. Returns an empty list outside a git
 * repo so brand-new project paths render gracefully.
 */
export async function listProjectFiles(cwd: string, limit = 5000): Promise<ProjectFileEntry[]> {
  let stdout: string;
  try {
    ({ stdout } = await runGit(cwd, ["ls-files", "--cached", "--others", "--exclude-standard"]));
  } catch (err) {
    if (err instanceof NotARepoError) return [];
    throw err;
  }
  const out: ProjectFileEntry[] = [];
  const seen = new Set<string>();
  for (const line of stdout.split(/\r?\n/)) {
    if (!line) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    out.push({ path: line, kind: "file" });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Returns the contents of `relPath` as of HEAD — the code editor's diff baseline. `relPath` is
 * repo-relative with forward slashes. Returns `null` when the path is untracked / absent at HEAD
 * (so the editor renders the whole buffer as added) or when `cwd` isn't a git repo. Mirrors the
 * private `readBaseline` in `diff.ts` but exposes just the blob the editor needs. A missing `git`
 * binary still bubbles as `GitNotFoundError`.
 */
export async function fileAtHead(cwd: string, relPath: string): Promise<string | null> {
  try {
    const { stdout } = await runGit(cwd, ["show", `HEAD:${relPath}`]);
    return stdout;
  } catch (err) {
    // GitCommandError covers "exists on disk but not in HEAD" (untracked) and "unknown revision"
    // (no commits yet); NotARepoError covers non-repo project roots. Both mean "no baseline".
    if (err instanceof GitCommandError || err instanceof NotARepoError) return null;
    throw err;
  }
}
