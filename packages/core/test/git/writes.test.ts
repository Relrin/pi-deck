import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runGit } from "../../src/git/runner.js";
import { checkoutPaths, stash, stashPop } from "../../src/git/writes.js";

/**
 * Integration tests against a real temp git repo. The mocks-only alternative wouldn't
 * catch the "is this the right git syntax?" failure modes that matter most here — the
 * IPC is a thin wrapper, so testing through `runGit` is the only way to know the args
 * we ship actually do what the docstring claims.
 */
async function initRepo(root: string): Promise<void> {
  await runGit(root, ["init", "-q", "-b", "main"]);
  await runGit(root, ["config", "user.email", "test@example.com"]);
  await runGit(root, ["config", "user.name", "Test"]);
  // commit.gpgsign defaults vary on dev machines — turn it off so the test doesn't fail
  // on contributors who have GPG signing globally enabled.
  await runGit(root, ["config", "commit.gpgsign", "false"]);
  // Windows git defaults to `core.autocrlf=true`, which silently rewrites `\n` to `\r\n`
  // on checkout — that would corrupt the byte-for-byte fixture comparisons below.
  await runGit(root, ["config", "core.autocrlf", "false"]);
}

async function commit(root: string, message: string): Promise<void> {
  await runGit(root, ["add", "-A"]);
  await runGit(root, ["commit", "-q", "-m", message]);
}

let repo: string;

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "pideck-writes-"));
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe("checkoutPaths", () => {
  test("restores a modified tracked file to HEAD", async () => {
    await initRepo(repo);
    const file = join(repo, "a.txt");
    await writeFile(file, "original\n");
    await commit(repo, "init");

    await writeFile(file, "modified\n");
    expect(await readFile(file, "utf8")).toBe("modified\n");

    await checkoutPaths(repo, { tracked: ["a.txt"], untracked: [] });
    expect(await readFile(file, "utf8")).toBe("original\n");
  });

  test("removes an untracked file via clean -f", async () => {
    await initRepo(repo);
    await writeFile(join(repo, "keep.txt"), "k\n");
    await commit(repo, "init");

    const ghost = join(repo, "ghost.txt");
    await writeFile(ghost, "new\n");
    expect(await readFile(ghost, "utf8")).toBe("new\n");

    await checkoutPaths(repo, { tracked: [], untracked: ["ghost.txt"] });
    await expect(readFile(ghost, "utf8")).rejects.toThrow();
  });

  test("handles mixed tracked + untracked in a single call", async () => {
    await initRepo(repo);
    await writeFile(join(repo, "tracked.txt"), "v1\n");
    await commit(repo, "init");

    await writeFile(join(repo, "tracked.txt"), "v2\n");
    await writeFile(join(repo, "untracked.txt"), "new\n");

    await checkoutPaths(repo, { tracked: ["tracked.txt"], untracked: ["untracked.txt"] });

    expect(await readFile(join(repo, "tracked.txt"), "utf8")).toBe("v1\n");
    await expect(readFile(join(repo, "untracked.txt"), "utf8")).rejects.toThrow();
  });

  test("no-op when both arrays are empty", async () => {
    await initRepo(repo);
    await writeFile(join(repo, "x.txt"), "x\n");
    await commit(repo, "init");
    // Just verifying it doesn't throw — there's no observable side effect to assert.
    await expect(checkoutPaths(repo, { tracked: [], untracked: [] })).resolves.toBeUndefined();
  });
});

describe("stash", () => {
  test("returns ok:true with a stash entry when the tree is dirty", async () => {
    await initRepo(repo);
    await writeFile(join(repo, "a.txt"), "v1\n");
    await commit(repo, "init");
    await writeFile(join(repo, "a.txt"), "v2\n");

    const outcome = await stash(repo, { message: "wip" });
    expect(outcome.ok).toBe(true);

    // Working tree is restored to HEAD; stash list has one entry.
    expect(await readFile(join(repo, "a.txt"), "utf8")).toBe("v1\n");
    const { stdout } = await runGit(repo, ["stash", "list"]);
    expect(stdout).toContain("wip");
  });

  test("returns ok:false reason=no_changes when the tree is clean", async () => {
    await initRepo(repo);
    await writeFile(join(repo, "a.txt"), "v1\n");
    await commit(repo, "init");

    const outcome = await stash(repo);
    expect(outcome).toEqual({
      ok: false,
      reason: "no_changes",
      stderr: expect.stringMatching(/no local changes/i),
    });
  });

  test("stashes only the requested paths when `paths` is set", async () => {
    await initRepo(repo);
    await writeFile(join(repo, "a.txt"), "v1\n");
    await writeFile(join(repo, "b.txt"), "v1\n");
    await commit(repo, "init");
    await writeFile(join(repo, "a.txt"), "v2\n");
    await writeFile(join(repo, "b.txt"), "v2\n");

    const outcome = await stash(repo, { paths: ["a.txt"] });
    expect(outcome.ok).toBe(true);

    // a.txt was stashed back to v1; b.txt still has the user's working-tree edit.
    expect(await readFile(join(repo, "a.txt"), "utf8")).toBe("v1\n");
    expect(await readFile(join(repo, "b.txt"), "utf8")).toBe("v2\n");
  });

  test("includes untracked files when includeUntracked is set", async () => {
    await initRepo(repo);
    await writeFile(join(repo, "a.txt"), "v1\n");
    await commit(repo, "init");
    await writeFile(join(repo, "new.txt"), "new\n");

    const outcome = await stash(repo, { includeUntracked: true });
    expect(outcome.ok).toBe(true);

    // Untracked file should be gone from the working tree (it's in the stash now).
    await expect(readFile(join(repo, "new.txt"), "utf8")).rejects.toThrow();
  });
});

describe("stashPop", () => {
  test("applies and drops the latest stash entry", async () => {
    await initRepo(repo);
    await writeFile(join(repo, "a.txt"), "v1\n");
    await commit(repo, "init");
    await writeFile(join(repo, "a.txt"), "v2\n");
    await runGit(repo, ["stash", "push", "-m", "wip"]);
    expect(await readFile(join(repo, "a.txt"), "utf8")).toBe("v1\n");

    const outcome = await stashPop(repo);
    expect(outcome.ok).toBe(true);
    expect(await readFile(join(repo, "a.txt"), "utf8")).toBe("v2\n");

    const { stdout } = await runGit(repo, ["stash", "list"]);
    expect(stdout.trim()).toBe("");
  });

  test("returns ok:false reason=empty_stack when there's nothing to pop", async () => {
    await initRepo(repo);
    await writeFile(join(repo, "a.txt"), "v1\n");
    await commit(repo, "init");

    const outcome = await stashPop(repo);
    expect(outcome).toEqual({
      ok: false,
      reason: "empty_stack",
      stderr: expect.any(String),
    });
  });

  test("returns ok:false reason=conflict when apply hits a merge conflict", async () => {
    await initRepo(repo);
    const file = join(repo, "a.txt");
    await writeFile(file, "v1\n");
    await commit(repo, "init");
    await writeFile(file, "v2\n");
    await runGit(repo, ["stash", "push", "-m", "wip"]);
    // Diverge the working tree so the stash pop can't fast-forward.
    await writeFile(file, "v3\n");
    await runGit(repo, ["add", "a.txt"]);

    const outcome = await stashPop(repo);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe("conflict");
    }
  });
});
