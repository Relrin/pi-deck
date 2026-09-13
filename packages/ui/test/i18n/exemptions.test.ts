import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Glob } from "bun";
import { collectExemptions, EXEMPT_GLOBS, matchesGlob } from "../../scripts/i18n-scan";

const UI_SRC = path.join(import.meta.dir, "..", "..", "src");

async function sourceFiles(): Promise<string[]> {
  const out: string[] = [];
  for await (const match of new Glob("**/*.{ts,tsx}").scan(UI_SRC)) {
    out.push(match.replaceAll("\\", "/"));
  }
  return out;
}

/**
 * The exemption mechanism is the one place where a reviewer's judgement replaces a rule, so it has
 * to stay honest in both directions: a path glob must still name something real, and every inline
 * marker must carry a reason.
 */
describe("i18n exemptions", () => {
  test("every path glob still matches a real file", async () => {
    // A rename would otherwise silently widen an exemption to nothing — the glob stops matching,
    // the file it protected starts being scanned, and the reason for the entry is lost.
    const files = await sourceFiles();
    for (const entry of EXEMPT_GLOBS) {
      const matched = files.filter((file) => matchesGlob(file, entry.glob));
      expect({ glob: entry.glob, matched: matched.length > 0 }).toEqual({
        glob: entry.glob,
        matched: true,
      });
    }
  });

  test("every path glob carries a reason", () => {
    for (const entry of EXEMPT_GLOBS) {
      expect(entry.reason.trim().length).toBeGreaterThanOrEqual(10);
    }
  });

  test("no inline marker is missing its reason", async () => {
    // A bare `// i18n-exempt` is a blanket suppression by another name. The scanner refuses to
    // honour one; this asserts none has crept in, with the offending lines in the failure message.
    const malformed: string[] = [];
    for (const file of await sourceFiles()) {
      const text = readFileSync(path.join(UI_SRC, file), "utf8");
      for (const entry of collectExemptions(text).malformed) {
        malformed.push(`${file}:${entry.line} — ${entry.text}`);
      }
    }
    expect(malformed).toEqual([]);
  });
});
