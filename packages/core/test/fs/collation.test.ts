import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { comparePaths, PATH_COLLATOR } from "../../src/fs/collation.js";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..", "..");

/**
 * Every surface that sorts file or directory names shares one collator, and that collator is
 * pinned to "en". Sorting is a stable-ordering concern, not a presentation one: a comparator that
 * follows the ambient locale reshuffles the diff list and the git changes list mid-review the
 * moment the user switches interface language, and lets the host-side walker disagree with the
 * renderer's re-sort.
 */
describe("path collation", () => {
  test("is constructed with an explicit locale, never the host default", () => {
    expect(PATH_COLLATOR.resolvedOptions().locale).toBe("en");
  });

  test("keeps the options the file tree depends on", () => {
    const opts = PATH_COLLATOR.resolvedOptions();
    expect(opts.numeric).toBe(true);
    expect(opts.sensitivity).toBe("base");
  });

  test("orders naturally and case-insensitively", () => {
    expect(["file10.ts", "file2.ts", "File1.ts"].sort(comparePaths)).toEqual([
      "File1.ts",
      "file2.ts",
      "file10.ts",
    ]);
  });

  test("is a plain comparator, usable directly in `.sort()`", () => {
    // `comparePaths` is `PATH_COLLATOR.compare` pre-bound; an unbound `Intl.Collator.prototype
    // .compare` throws when called without its receiver, which is exactly what `.sort(fn)` does.
    expect(() => ["b", "a"].sort(comparePaths)).not.toThrow();
  });
});

/**
 * Source-level ratchet. The failure this guards against is silent — the code still compiles, still
 * sorts, and only misbehaves once a user switches language — so the only cheap guard is to keep
 * the locale-dependent spellings out of the tree entirely.
 */
describe("no locale-dependent collation is reintroduced", () => {
  const SORTING_SITES = [
    "packages/core/src/fs/walker.ts",
    "packages/core/src/host/fs-watch-manager.ts",
    "packages/ui/src/features/files/useFileTreeStore.ts",
    "packages/ui/src/features/diff/diffNav.ts",
    "packages/ui/src/features/git/ChangesList.tsx",
  ];

  test.each(SORTING_SITES)("%s sorts through the shared collator", (relative) => {
    const source = readFileSync(join(REPO_ROOT, relative), "utf8");
    expect(source).toContain("comparePaths");
    // Both spellings default to the ambient locale when their locale argument is `undefined`.
    expect(source).not.toContain("new Intl.Collator(undefined");
    expect(source).not.toContain("localeCompare(");
  });
});
