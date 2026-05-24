import { GitCommandError, runGit } from "./runner.js";
import type { GitBranchInfo } from "./types.js";

export async function listBranches(cwd: string): Promise<GitBranchInfo[]> {
  const { stdout } = await runGit(cwd, [
    "for-each-ref",
    "--sort=-committerdate",
    "--format=%(refname:short)|%(committerdate:iso8601-strict)|%(HEAD)",
    "refs/heads/",
  ]);
  const out: GitBranchInfo[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line) continue;
    const [name, date, head] = line.split("|");
    out.push({
      name: name ?? "",
      isCurrent: head?.trim() === "*",
      lastActivityAt: date || undefined,
    });
  }

  const defaultBranch = await detectDefaultBranch(cwd);
  if (defaultBranch) {
    const merged = await listMergedBranchNames(cwd, defaultBranch);
    for (const entry of out) {
      entry.merged = entry.name !== defaultBranch && merged.has(entry.name);
    }
  }
  return out;
}

/**
 * Best-effort detection of the repo's default branch — the line we use to compute the
 * "merged" badge in the picker. Order of attempts mirrors what most teams have today:
 *   1. `origin/HEAD` symbolic ref (the canonical answer if the remote has been fetched).
 *   2. local `main`, then `master` as a fallback.
 * Returns undefined when none of those resolve; callers treat that as "skip merged
 * detection" rather than guessing.
 */
export async function detectDefaultBranch(cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await runGit(cwd, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
    const ref = stdout.trim(); // e.g. "origin/main"
    if (ref.startsWith("origin/")) return ref.slice("origin/".length);
  } catch {
    // origin not configured, or no HEAD set — fall through to the local-branch probes.
  }
  for (const candidate of ["main", "master"]) {
    try {
      await runGit(cwd, ["rev-parse", "--verify", `refs/heads/${candidate}`]);
      return candidate;
    } catch {
      // not present locally — try the next one
    }
  }
  return undefined;
}

async function listMergedBranchNames(cwd: string, into: string): Promise<Set<string>> {
  try {
    const { stdout } = await runGit(cwd, [
      "for-each-ref",
      "--merged",
      `refs/heads/${into}`,
      "--format=%(refname:short)",
      "refs/heads/",
    ]);
    const set = new Set<string>();
    for (const line of stdout.split(/\r?\n/)) {
      const name = line.trim();
      if (name) set.add(name);
    }
    return set;
  } catch (err) {
    // `--merged` fails when the target ref doesn't exist (e.g. someone deleted `main`
    // locally between detection and this call). Treat it as "nothing is merged" rather
    // than propagating — the picker handles a missing flag gracefully.
    if (err instanceof GitCommandError) return new Set();
    throw err;
  }
}

export async function currentBranch(cwd: string): Promise<string> {
  const { stdout } = await runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  return stdout.trim();
}

export async function checkoutBranch(cwd: string, name: string): Promise<void> {
  await runGit(cwd, ["checkout", name]);
}

export async function createBranch(cwd: string, name: string): Promise<void> {
  await runGit(cwd, ["checkout", "-b", name]);
}
