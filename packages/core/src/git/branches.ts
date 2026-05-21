import { runGit } from "./runner.js";
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
  return out;
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
