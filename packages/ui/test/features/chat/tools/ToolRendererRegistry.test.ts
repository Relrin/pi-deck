import { describe, expect, test } from "bun:test";
import {
  getRenderer,
  getSummarizer,
  registerToolRenderer,
} from "../../../../src/features/chat/tools/ToolRendererRegistry";
import type { ToolRenderer } from "../../../../src/features/chat/tools/types";

const RENDERER: ToolRenderer = () => null;

describe("ToolRendererRegistry", () => {
  test("registers and retrieves a renderer by name", () => {
    registerToolRenderer("test-tool", RENDERER);
    expect(getRenderer("test-tool")).toBe(RENDERER);
  });

  test("returns undefined for unknown names", () => {
    expect(getRenderer("does-not-exist")).toBeUndefined();
  });

  test("summarizer is optional", () => {
    registerToolRenderer("no-summary", RENDERER);
    expect(getSummarizer("no-summary")).toBeUndefined();
  });

  test("summarizer is stored when provided", () => {
    const summarizer = () => ({ text: "label" });
    registerToolRenderer("with-summary", RENDERER, summarizer);
    expect(getSummarizer("with-summary")).toBe(summarizer);
  });

  test("re-registering overwrites the previous renderer", () => {
    const a: ToolRenderer = () => null;
    const b: ToolRenderer = () => null;
    registerToolRenderer("dup", a);
    registerToolRenderer("dup", b);
    expect(getRenderer("dup")).toBe(b);
  });
});
