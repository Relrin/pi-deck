import { describe, expect, test } from "bun:test";
import {
  getCachedHighlight,
  highlight,
} from "../../../../src/features/chat/messages/code-highlight";

describe("highlight", () => {
  test("returns Shiki HTML for a known language", async () => {
    const html = await highlight({ code: "const x = 1", lang: "ts" });
    expect(html).toContain("<pre");
    expect(html.toLowerCase()).toContain("const");
  });

  test("falls back gracefully for an unknown language", async () => {
    const html = await highlight({ code: "abc def", lang: "this-lang-does-not-exist" });
    expect(html).toContain("<pre");
    expect(html).toContain("abc def");
  });

  test("escapes raw HTML when rendering as text", async () => {
    const html = await highlight({ code: "<script>alert(1)</script>", lang: "text" });
    expect(html).not.toContain("<script>");
  });

  test("native theme passes syn-* CSS variables through to inline styles", async () => {
    const html = await highlight({ code: "const x = 1;", lang: "ts" });
    expect(html).toContain("var(--syn-");
    expect(html).toContain("var(--code-bg)");
  });

  test("caches highlighted HTML so a virtualized remount can seed synchronously", async () => {
    const code = "const cachedForRemount = 42;";
    // Not cached until the first highlight resolves.
    expect(getCachedHighlight(code, "ts")).toBeUndefined();
    const html = await highlight({ code, lang: "ts" });
    // Subsequent (synchronous) lookups return the same HTML — no re-highlight on remount.
    expect(getCachedHighlight(code, "ts")).toBe(html);
    // Keyed by language too.
    expect(getCachedHighlight(code, "js")).toBeUndefined();
  });
});
