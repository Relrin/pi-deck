import { describe, expect, test } from "bun:test";
import {
  COMPLETION_ICONS,
  completionIconMaskUrl,
} from "../../src/features/editor/codicon-symbols.js";

/** Every completion `type` @codemirror/lsp-client's kindToType table can emit. */
const LSP_CLIENT_TYPES = [
  "text",
  "method",
  "function",
  "class",
  "property",
  "variable",
  "interface",
  "namespace",
  "keyword",
  "constant",
  "type",
];

describe("completion icons", () => {
  test("covers every completion type the LSP client emits", () => {
    for (const type of LSP_CLIENT_TYPES) {
      expect(COMPLETION_ICONS[type]).toBeDefined();
    }
  });

  test("icons carry a theme token and verbatim <path> markup", () => {
    for (const icon of Object.values(COMPLETION_ICONS)) {
      expect(icon.token).toMatch(/^--[a-z0-9-]+$/);
      expect(icon.body.startsWith("<path")).toBe(true);
      expect(icon.body.endsWith("/>")).toBe(true);
    }
  });

  test("mask url is a quoted, percent-encoded svg data uri", () => {
    const icon = COMPLETION_ICONS.class;
    expect(icon).toBeDefined();
    if (!icon) return;
    const url = completionIconMaskUrl(icon);
    expect(url.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(url.endsWith('")')).toBe(true);
    // Nothing inside may break out of the CSS url("...") context or the data URI.
    const payload = url.slice('url("data:image/svg+xml,'.length, -2);
    expect(payload).not.toContain('"');
    expect(payload).not.toContain("<");
    expect(payload).not.toContain(">");
  });
});
