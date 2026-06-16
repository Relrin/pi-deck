import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { usePreferencesStore } from "../../src/theme/usePreferencesStore";

const STORAGE_KEY = "pi-deck:prefs";

describe("usePreferencesStore — viewMode", () => {
  beforeEach(() => {
    localStorage.clear();
    usePreferencesStore.setState({ viewMode: "agent" });
  });

  afterEach(() => {
    localStorage.clear();
    usePreferencesStore.setState({ viewMode: "agent" });
  });

  test("defaults to agent", () => {
    expect(usePreferencesStore.getState().viewMode).toBe("agent");
  });

  test("setViewMode updates and persists", () => {
    usePreferencesStore.getState().setViewMode("ide");
    expect(usePreferencesStore.getState().viewMode).toBe("ide");

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(persisted.state.viewMode).toBe("ide");

    usePreferencesStore.getState().setViewMode("agent");
    expect(usePreferencesStore.getState().viewMode).toBe("agent");
  });
});
