import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { move } from "../../src/fs/ops.js";
import { FsExistsError, PathEscapeError } from "../../src/fs/types.js";

/**
 * `move` backs the file tree's cross-directory drag-and-drop. These exercise the real
 * filesystem against a temp project root so the path-escape / self-descendant guards are
 * verified the way the router actually calls them.
 */
let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pideck-ops-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

describe("move", () => {
  test("moves a file into a sibling directory, preserving its basename", async () => {
    const from = join(root, "a.txt");
    const dest = join(root, "sub");
    await writeFile(from, "hi");
    await mkdir(dest);

    const target = await move({ projectRoot: root, fromPath: from, toDir: dest });

    expect(target).toBe(join(dest, "a.txt"));
    expect(await exists(from)).toBe(false);
    expect(await exists(join(dest, "a.txt"))).toBe(true);
  });

  test("dropping onto the current parent is a no-op (returns the same path)", async () => {
    const from = join(root, "a.txt");
    await writeFile(from, "hi");

    const target = await move({ projectRoot: root, fromPath: from, toDir: root });

    expect(target).toBe(from);
    expect(await exists(from)).toBe(true);
  });

  test("rejects a collision at the destination", async () => {
    const from = join(root, "a.txt");
    const dest = join(root, "sub");
    await writeFile(from, "hi");
    await mkdir(dest);
    await writeFile(join(dest, "a.txt"), "existing");

    await expect(move({ projectRoot: root, fromPath: from, toDir: dest })).rejects.toBeInstanceOf(
      FsExistsError,
    );
    // The original is untouched after a rejected move.
    expect(await exists(from)).toBe(true);
  });

  test("rejects a destination outside the project root", async () => {
    const from = join(root, "a.txt");
    await writeFile(from, "hi");

    await expect(
      move({ projectRoot: root, fromPath: from, toDir: join(root, "..") }),
    ).rejects.toBeInstanceOf(PathEscapeError);
  });

  test("rejects moving a directory into its own descendant", async () => {
    const dir = join(root, "parent");
    const child = join(root, "parent", "child");
    await mkdir(child, { recursive: true });

    await expect(move({ projectRoot: root, fromPath: dir, toDir: child })).rejects.toThrow(
      /into itself/,
    );
    expect(await exists(dir)).toBe(true);
  });

  test("creates the destination directory if it does not exist yet", async () => {
    const from = join(root, "a.txt");
    await writeFile(from, "hi");
    const dest = join(root, "fresh", "nested");

    const target = await move({ projectRoot: root, fromPath: from, toDir: dest });

    expect(target).toBe(join(dest, "a.txt"));
    expect(await exists(join(dest, "a.txt"))).toBe(true);
  });
});
