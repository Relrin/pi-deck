import { beforeEach, describe, expect, test } from "bun:test";
import { useSessionDefaultsStore } from "../../../src/features/settings/useSessionDefaultsStore";

const INITIAL = useSessionDefaultsStore.getState();

beforeEach(() => {
  useSessionDefaultsStore.setState({
    defaultThinkingLevel: INITIAL.defaultThinkingLevel,
    defaultAgentMode: INITIAL.defaultAgentMode,
  });
});

describe("useSessionDefaultsStore", () => {
  test("built-in defaults are medium effort and accept-edits", () => {
    const s = useSessionDefaultsStore.getState();
    expect(s.defaultThinkingLevel).toBe("medium");
    expect(s.defaultAgentMode).toBe("accept-edits");
  });

  test("setDefaultThinkingLevel updates the level", () => {
    useSessionDefaultsStore.getState().setDefaultThinkingLevel("high");
    expect(useSessionDefaultsStore.getState().defaultThinkingLevel).toBe("high");
  });

  test("setDefaultAgentMode updates the mode", () => {
    useSessionDefaultsStore.getState().setDefaultAgentMode("plan");
    expect(useSessionDefaultsStore.getState().defaultAgentMode).toBe("plan");
  });
});
