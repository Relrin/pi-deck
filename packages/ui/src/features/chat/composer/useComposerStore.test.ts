import { beforeEach, describe, expect, test } from "bun:test";
import { useComposerStore } from "./useComposerStore";

beforeEach(() => {
  useComposerStore.setState({ executionMode: "ask" });
});

describe("useComposerStore", () => {
  test("setMode updates the executionMode", () => {
    useComposerStore.getState().setMode("plan");
    expect(useComposerStore.getState().executionMode).toBe("plan");
    useComposerStore.getState().setMode("accept-edits");
    expect(useComposerStore.getState().executionMode).toBe("accept-edits");
  });
});
