import { describe, expect, test } from "bun:test";
import {
  adaptVSCodeTheme,
  flattenTokenColors,
  resolveScope,
} from "../../src/host/themes/vscode-adapter.js";

describe("flattenTokenColors / resolveScope", () => {
  test("exact selector match", () => {
    const rules = flattenTokenColors([{ scope: "keyword", settings: { foreground: "#abcdef" } }]);
    expect(resolveScope(rules, "keyword")?.foreground).toBe("#abcdef");
  });

  test("selector matches as dotted prefix", () => {
    const rules = flattenTokenColors([{ scope: "keyword", settings: { foreground: "#abcdef" } }]);
    expect(resolveScope(rules, "keyword.control.ts")?.foreground).toBe("#abcdef");
  });

  test("a bare prefix that is not a dotted segment does not match", () => {
    const rules = flattenTokenColors([{ scope: "key", settings: { foreground: "#ffffff" } }]);
    expect(resolveScope(rules, "keyword")).toBeUndefined();
  });

  test("comma-separated scope strings are split into selectors", () => {
    const rules = flattenTokenColors([
      { scope: "string, constant.numeric", settings: { foreground: "#00ff00" } },
    ]);
    expect(resolveScope(rules, "string.quoted.ts")?.foreground).toBe("#00ff00");
    expect(resolveScope(rules, "constant.numeric.decimal")?.foreground).toBe("#00ff00");
  });

  test("array scopes are accepted", () => {
    const rules = flattenTokenColors([
      { scope: ["entity.name.function", "support.function"], settings: { foreground: "#dcdcaa" } },
    ]);
    expect(resolveScope(rules, "support.function.builtin")?.foreground).toBe("#dcdcaa");
  });

  test("longest matching selector wins", () => {
    const rules = flattenTokenColors([
      { scope: "comment", settings: { foreground: "#111111" } },
      { scope: "comment.block.documentation", settings: { foreground: "#222222" } },
    ]);
    expect(resolveScope(rules, "comment.block.documentation.ts")?.foreground).toBe("#222222");
    expect(resolveScope(rules, "comment.line")?.foreground).toBe("#111111");
  });

  test("equal-length tie goes to the later rule", () => {
    const rules = flattenTokenColors([
      { scope: "keyword", settings: { foreground: "#aaaaaa" } },
      { scope: "keyword", settings: { foreground: "#bbbbbb" } },
    ]);
    expect(resolveScope(rules, "keyword.control")?.foreground).toBe("#bbbbbb");
  });

  test("descendant selectors (with spaces) are skipped", () => {
    const rules = flattenTokenColors([
      { scope: "source.ts string", settings: { foreground: "#123456" } },
    ]);
    expect(rules).toHaveLength(0);
    expect(resolveScope(rules, "string")).toBeUndefined();
  });

  test("foreground and fontStyle cascade independently", () => {
    const rules = flattenTokenColors([
      { scope: "comment", settings: { fontStyle: "italic" } },
      { scope: "comment.line", settings: { foreground: "#333333" } },
    ]);
    const resolved = resolveScope(rules, "comment.line.double-slash");
    expect(resolved?.foreground).toBe("#333333");
    expect(resolved?.fontStyle).toBe("italic");
  });
});

describe("adaptVSCodeTheme syntax + terminal mapping", () => {
  const mini = {
    name: "Mini Dark",
    type: "dark" as const,
    colors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#d4d4d4",
      "terminal.ansiRed": "#ff5555",
      "terminal.ansiBrightCyan": "#88ffff",
    },
    tokenColors: [
      { scope: "keyword", settings: { foreground: "#c586c0" } },
      { scope: "comment", settings: { foreground: "#6a9955", fontStyle: "italic" } },
      { scope: ["entity.name.function"], settings: { foreground: "#dcdcaa" } },
      { scope: "string", settings: { foreground: "#ce9178" } },
    ],
  };

  test("maps tokenColors onto syn-* and terminal.ansi* onto term-*", () => {
    const { spec } = adaptVSCodeTheme(mini);
    expect(spec["syn-keyword"]).toBe("#c586c0");
    expect(spec["syn-comment"]).toBe("#6a9955");
    expect(spec["syn-comment-style"]).toBe("italic");
    expect(spec["syn-function"]).toBe("#dcdcaa");
    expect(spec["syn-string"]).toBe("#ce9178");
    expect(spec["term-red"]).toBe("#ff5555");
    expect(spec["term-bright-cyan"]).toBe("#88ffff");
  });

  test("unmatched tokens are omitted so CSS defaults apply", () => {
    const { spec } = adaptVSCodeTheme(mini);
    expect(spec["syn-tag"]).toBeUndefined();
    expect(spec["syn-attribute"]).toBeUndefined();
    expect(spec["term-blue"]).toBeUndefined();
  });

  test("comment fontStyle without italic maps to normal", () => {
    const { spec } = adaptVSCodeTheme({
      type: "dark",
      tokenColors: [{ scope: "comment", settings: { foreground: "#888888", fontStyle: "bold" } }],
    });
    expect(spec["syn-comment-style"]).toBe("normal");
  });

  test("theme without tokenColors produces no syn-* or term-* keys", () => {
    const { spec } = adaptVSCodeTheme({ name: "bare", type: "dark", colors: {} });
    const extra = Object.keys(spec).filter((k) => k.startsWith("syn-") || k.startsWith("term-"));
    expect(extra).toEqual([]);
  });
});
