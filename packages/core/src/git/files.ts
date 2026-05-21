import { NotARepoError, runGit } from "./runner.js";

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
