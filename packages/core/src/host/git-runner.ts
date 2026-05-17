import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface GitBranchInfo {
  name: string;
  isCurrent: boolean;
  lastActivityAt?: string;
}

export class GitError extends Error {
  constructor(
    public readonly code: "not_a_repo" | "git_failed",
    message: string,
  ) {
    super(message);
  }
}

async function runGit(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await exec("git", args, { cwd, maxBuffer: 8 * 1024 * 1024 });
    return stdout;
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string };
    const stderr = (e.stderr ?? "").toString().trim();
    if (/not a git repository/i.test(stderr)) {
      throw new GitError("not_a_repo", "Project path is not a git repository");
    }
    throw new GitError("git_failed", stderr || e.message);
  }
}

export async function listBranches(cwd: string): Promise<GitBranchInfo[]> {
  const stdout = await runGit(cwd, [
    "for-each-ref",
    "--sort=-committerdate",
    "--format=%(refname:short)|%(committerdate:iso8601-strict)|%(HEAD)",
    "refs/heads/",
  ]);
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  return lines.map((line) => {
    const [name, date, head] = line.split("|");
    return {
      name: name ?? "",
      isCurrent: head?.trim() === "*",
      lastActivityAt: date || undefined,
    };
  });
}

export async function currentBranch(cwd: string): Promise<string> {
  const stdout = await runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  return stdout.trim();
}

export async function checkoutBranch(cwd: string, name: string): Promise<void> {
  await runGit(cwd, ["checkout", name]);
}

export interface ProjectFileEntry {
  path: string;
  kind: "file";
}

/**
 * Enumerates every tracked + untracked-but-not-ignored file in the working tree, capped at
 * `limit`. We lean on `git ls-files --cached --others --exclude-standard` so .gitignore is
 * honored without us re-implementing pattern matching. Falls back to an empty list outside
 * a git repo (e.g. brand-new project paths).
 */
export async function listProjectFiles(cwd: string, limit = 5000): Promise<ProjectFileEntry[]> {
  let stdout: string;
  try {
    stdout = await runGit(cwd, ["ls-files", "--cached", "--others", "--exclude-standard"]);
  } catch (err) {
    if (err instanceof GitError && err.code === "not_a_repo") return [];
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
