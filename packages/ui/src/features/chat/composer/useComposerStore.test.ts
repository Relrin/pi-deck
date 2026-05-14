import { beforeEach, describe, expect, test } from "bun:test";
import { modelSupportsThinking, useComposerStore } from "./useComposerStore";

const DEFAULTS = {
  executionMode: "ask" as const,
  model: "claude-sonnet-4-6",
  thinkingEffort: "off" as const,
};

beforeEach(() => {
  useComposerStore.setState(DEFAULTS);
});

describe("useComposerStore", () => {
  test("setters update each field independently", () => {
    useComposerStore.getState().setMode("plan");
    useComposerStore.getState().setModel("claude-opus-4-7");
    useComposerStore.getState().setEffort("high");
    const s = useComposerStore.getState();
    expect(s.executionMode).toBe("plan");
    expect(s.model).toBe("claude-opus-4-7");
    expect(s.thinkingEffort).toBe("high");
  });
});

describe("modelSupportsThinking", () => {
  test("returns true for thinking-capable models", () => {
    expect(modelSupportsThinking("claude-opus-4-7")).toBe(true);
    expect(modelSupportsThinking("claude-sonnet-4-6")).toBe(true);
  });

  test("returns false for non-thinking models", () => {
    expect(modelSupportsThinking("claude-haiku-4-5")).toBe(false);
    expect(modelSupportsThinking("gpt-5")).toBe(false);
  });

  test("returns false for unknown models", () => {
    expect(modelSupportsThinking("totally-made-up")).toBe(false);
  });
});
