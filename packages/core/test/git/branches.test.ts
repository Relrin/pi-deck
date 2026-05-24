import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectDefaultBranch, listBranches } from "../../src/git/branches.js";
import { runGit } from "../../src/git/runner.js";

async function initRepo(root: string): Promise<void> {
  await runGit(root, ["init", "-q", "-b", "main"]);
  await runGit(root, ["config", "user.email", "test@example.com"]);
  await runGit(root, ["config", "user.name", "Test"]);
  await runGit(root, ["config", "commit.gpgsign", "false"]);
  await runGit(root, ["config", "core.autocrlf", "false"]);
}

async function commitFile(root: string, name: string, content: string): Promise<void> {
  await writeFile(join(root, name), content);
  await runGit(root, ["add", name]);
  await runGit(root, ["commit", "-q", "-m", `add ${name}`]);
}

let repo: string;

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "pideck-branches-"));
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe("detectDefaultBranch", () => {
  test("returns the local default when origin is not configured (main)", async () => {
    await initRepo(repo);
    await commitFile(repo, "x.txt", "x\n");
    expect(await detectDefaultBranch(repo)).toBe("main");
  });

  test("returns master when only master exists locally", async () => {
    await runGit(repo, ["init", "-q", "-b", "master"]);
    await runGit(repo, ["config", "user.email", "t@e.com"]);
    await runGit(repo, ["config", "user.name", "Test"]);
    await runGit(repo, ["config", "commit.gpgsign", "false"]);
    await commitFile(repo, "x.txt", "x\n");
    expect(await detectDefaultBranch(repo)).toBe("master");
  });

  test("returns undefined when neither main nor master nor origin/HEAD is present", async () => {
    await runGit(repo, ["init", "-q", "-b", "trunk"]);
    await runGit(repo, ["config", "user.email", "t@e.com"]);
    await runGit(repo, ["config", "user.name", "Test"]);
    await runGit(repo, ["config", "commit.gpgsign", "false"]);
    await commitFile(repo, "x.txt", "x\n");
    expect(await detectDefaultBranch(repo)).toBeUndefined();
  });
});

describe("listBranches with merged decoration", () => {
  test("marks branches reachable from the default as merged, leaves the default itself unmarked", async () => {
    await initRepo(repo);
    await commitFile(repo, "x.txt", "x\n");
    // feat-merged: an ancestor of main (created BEFORE main moved forward) — main contains
    // feat-merged's tip, so feat-merged is "merged into main".
    await runGit(repo, ["checkout", "-b", "feat-merged"]);
    await commitFile(repo, "merged.txt", "m\n");
    await runGit(repo, ["checkout", "main"]);
    await runGit(repo, ["merge", "--no-ff", "feat-merged", "-m", "merge"]);
    // feat-pending: branched off main *after* the merge, then added a commit main hasn't
    // seen. Not merged into main.
    await runGit(repo, ["checkout", "-b", "feat-pending"]);
    await commitFile(repo, "pending.txt", "p\n");
    await runGit(repo, ["checkout", "main"]);

    const branches = await listBranches(repo);
    const byName = Object.fromEntries(branches.map((b) => [b.name, b]));
    expect(byName.main).toBeDefined();
    // main is the default — never tagged "merged" against itself.
    expect(byName.main?.merged).toBe(false);
    expect(byName["feat-merged"]?.merged).toBe(true);
    expect(byName["feat-pending"]?.merged).toBe(false);
  });

  test("leaves merged undefined when there's no detectable default", async () => {
    await runGit(repo, ["init", "-q", "-b", "trunk"]);
    await runGit(repo, ["config", "user.email", "t@e.com"]);
    await runGit(repo, ["config", "user.name", "Test"]);
    await runGit(repo, ["config", "commit.gpgsign", "false"]);
    await commitFile(repo, "x.txt", "x\n");
    const branches = await listBranches(repo);
    // No default branch detected → we skip the decoration pass entirely.
    expect(branches[0]?.merged).toBeUndefined();
  });
});
