import { describe, expect, test } from "bun:test";
import type { GitChange } from "@pi-deck/core/git/types.js";
import { neighborDiffFile, orderedDiffFiles } from "../../../src/features/diff/diffNav.js";

function change(path: string, status: GitChange["status"]): GitChange {
  return { path, status, staged: false, untracked: status === "?", add: 0, del: 0 };
}

describe("orderedDiffFiles", () => {
  test("keeps tracked changes in natural path order and drops untracked", () => {
    const changes = [
      change("src/b.ts", "M"),
      change("src/a.ts", "A"),
      change("scratch.txt", "?"), // untracked → no diff → excluded
      change("src/gone.ts", "D"),
    ];
    expect(orderedDiffFiles(changes)).toEqual(["src/a.ts", "src/b.ts", "src/gone.ts"]);
  });

  test("returns [] for undefined / all-untracked input", () => {
    expect(orderedDiffFiles(undefined)).toEqual([]);
    expect(orderedDiffFiles([change("new.txt", "?")])).toEqual([]);
  });
});

describe("neighborDiffFile", () => {
  const files = ["a.ts", "b.ts", "c.ts"];

  test("returns the next / previous file", () => {
    expect(neighborDiffFile(files, "a.ts", 1)).toBe("b.ts");
    expect(neighborDiffFile(files, "b.ts", 1)).toBe("c.ts");
    expect(neighborDiffFile(files, "b.ts", -1)).toBe("a.ts");
  });

  test("does not wrap at the ends", () => {
    expect(neighborDiffFile(files, "c.ts", 1)).toBeUndefined();
    expect(neighborDiffFile(files, "a.ts", -1)).toBeUndefined();
  });

  test("returns undefined when the current file isn't in the list", () => {
    expect(neighborDiffFile(files, "zzz.ts", 1)).toBeUndefined();
  });
});
