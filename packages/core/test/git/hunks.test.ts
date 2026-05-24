import { describe, expect, test } from "bun:test";
import { parseHunks } from "../../src/git/hunks.js";

describe("parseHunks", () => {
  test("modified file with two hunks", () => {
    const stdout = [
      "diff --git a/src/foo.ts b/src/foo.ts",
      "index abc..def 100644",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -12,2 +12,3 @@",
      "-old a",
      "-old b",
      "+new a",
      "+new b",
      "+new c",
      "@@ -50 +51,2 @@",
      "-x",
      "+y",
      "+z",
      "",
    ].join("\n");

    const map = parseHunks(stdout);
    const hunks = map.get("src/foo.ts");
    expect(hunks).toBeDefined();
    expect(hunks).toEqual([
      { oldStart: 12, oldLines: 2, newStart: 12, newLines: 3, add: 3, del: 2 },
      // Header `-50` (no comma) defaults to 1 line; `+51,2` is two added lines starting at 51.
      { oldStart: 50, oldLines: 1, newStart: 51, newLines: 2, add: 2, del: 1 },
    ]);
  });

  test("new file (--- /dev/null) keys off the +++ b/ line", () => {
    const stdout = [
      "diff --git a/new.ts b/new.ts",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/new.ts",
      "@@ -0,0 +1,3 @@",
      "+line one",
      "+line two",
      "+line three",
      "",
    ].join("\n");

    const map = parseHunks(stdout);
    expect(map.get("new.ts")).toEqual([
      { oldStart: 0, oldLines: 0, newStart: 1, newLines: 3, add: 3, del: 0 },
    ]);
  });

  test("deleted file (+++ /dev/null) keys off the --- a/ line", () => {
    const stdout = [
      "diff --git a/gone.ts b/gone.ts",
      "deleted file mode 100644",
      "--- a/gone.ts",
      "+++ /dev/null",
      "@@ -1,2 +0,0 @@",
      "-line one",
      "-line two",
      "",
    ].join("\n");

    const map = parseHunks(stdout);
    expect(map.get("gone.ts")).toEqual([
      { oldStart: 1, oldLines: 2, newStart: 0, newLines: 0, add: 0, del: 2 },
    ]);
  });

  test("empty stdout produces an empty map", () => {
    expect(parseHunks("")).toEqual(new Map());
  });

  test("multiple files in one stream", () => {
    const stdout = [
      "diff --git a/a.ts b/a.ts",
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -1 +1 @@",
      "-a",
      "+A",
      "diff --git a/b.ts b/b.ts",
      "--- a/b.ts",
      "+++ b/b.ts",
      "@@ -5,0 +6,1 @@",
      "+inserted",
      "",
    ].join("\n");

    const map = parseHunks(stdout);
    expect([...map.keys()].sort()).toEqual(["a.ts", "b.ts"]);
    expect(map.get("a.ts")?.length).toBe(1);
    expect(map.get("b.ts")?.length).toBe(1);
  });
});
