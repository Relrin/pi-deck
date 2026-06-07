import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { move, readTextFile, writeTextFile } from "../../src/fs/ops.js";
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

describe("readTextFile", () => {
  test("reads LF content and reports lf", async () => {
    const p = join(root, "a.ts");
    await writeFile(p, "const a = 1;\nconst b = 2;\n");
    const res = await readTextFile({ projectRoot: root, path: p });
    expect(res.content).toBe("const a = 1;\nconst b = 2;\n");
    expect(res.eol).toBe("lf");
    expect(res.binary).toBe(false);
    expect(res.tooLarge).toBe(false);
  });

  test("detects CRLF and normalises content to LF", async () => {
    const p = join(root, "win.txt");
    await writeFile(p, "a\r\nb\r\nc");
    const res = await readTextFile({ projectRoot: root, path: p });
    expect(res.eol).toBe("crlf");
    expect(res.content).toBe("a\nb\nc");
  });

  test("strips a leading UTF-8 BOM", async () => {
    const p = join(root, "bom.txt");
    await writeFile(p, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("hello")]));
    const res = await readTextFile({ projectRoot: root, path: p });
    expect(res.content).toBe("hello");
  });

  test("flags a binary file (NUL byte) and returns empty content", async () => {
    const p = join(root, "blob.bin");
    await writeFile(p, Buffer.from([0x68, 0x00, 0x69]));
    const res = await readTextFile({ projectRoot: root, path: p });
    expect(res.binary).toBe(true);
    expect(res.content).toBe("");
  });

  test("flags an oversized file without reading it into content", async () => {
    const p = join(root, "big.txt");
    await writeFile(p, "a".repeat(2 * 1024 * 1024 + 1));
    const res = await readTextFile({ projectRoot: root, path: p });
    expect(res.tooLarge).toBe(true);
    expect(res.content).toBe("");
  });

  test("rejects a path outside the project root", async () => {
    await expect(
      readTextFile({ projectRoot: root, path: join(root, "..", "escape.txt") }),
    ).rejects.toBeInstanceOf(PathEscapeError);
  });
});

describe("writeTextFile", () => {
  test("round-trips LF content", async () => {
    const p = join(root, "out.ts");
    await writeTextFile({ projectRoot: root, path: p, content: "x\ny\n", eol: "lf" });
    expect((await readFile(p)).toString("utf8")).toBe("x\ny\n");
  });

  test("re-applies CRLF on write", async () => {
    const p = join(root, "out-crlf.txt");
    await writeTextFile({ projectRoot: root, path: p, content: "x\ny\n", eol: "crlf" });
    expect((await readFile(p)).toString("utf8")).toBe("x\r\ny\r\n");
  });

  test("rejects a path outside the project root", async () => {
    await expect(
      writeTextFile({ projectRoot: root, path: join(root, "..", "x.txt"), content: "", eol: "lf" }),
    ).rejects.toBeInstanceOf(PathEscapeError);
  });
});
