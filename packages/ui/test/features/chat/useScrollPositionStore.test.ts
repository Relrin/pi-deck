import { beforeEach, describe, expect, test } from "bun:test";
import { useScrollPositionStore } from "../../../src/features/chat/useScrollPositionStore";

beforeEach(() => {
  useScrollPositionStore.setState({ bySession: {} });
});

describe("useScrollPositionStore", () => {
  test("snapshot then get round-trips", () => {
    useScrollPositionStore.getState().snapshot("a", { offset: 120, atBottom: false });
    expect(useScrollPositionStore.getState().get("a")).toEqual({
      offset: 120,
      atBottom: false,
    });
  });

  test("snapshot overwrites the previous value for the same session", () => {
    useScrollPositionStore.getState().snapshot("a", { offset: 100, atBottom: false });
    useScrollPositionStore.getState().snapshot("a", { offset: 0, atBottom: true });
    expect(useScrollPositionStore.getState().get("a")?.atBottom).toBe(true);
  });

  test("get returns undefined for unknown sessions", () => {
    expect(useScrollPositionStore.getState().get("missing")).toBeUndefined();
  });

  test("clear removes only the requested session", () => {
    useScrollPositionStore.getState().snapshot("a", { offset: 1, atBottom: false });
    useScrollPositionStore.getState().snapshot("b", { offset: 2, atBottom: false });
    useScrollPositionStore.getState().clear("a");
    expect(useScrollPositionStore.getState().get("a")).toBeUndefined();
    expect(useScrollPositionStore.getState().get("b")?.offset).toBe(2);
  });
});
