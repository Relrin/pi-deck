import { describe, expect, test } from "bun:test";
import { highlight } from "./code-highlight";

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
});
