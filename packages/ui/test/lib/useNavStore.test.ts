import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { useNavStore } from "../../src/lib/useNavStore";

const STORAGE_KEY = "pi-deck:nav:v1";

function resetStore() {
  useNavStore.setState({
    screen: "blank",
    expandedProjectsRail: {},
  });
}

describe("useNavStore", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  afterEach(() => {
    localStorage.clear();
    resetStore();
  });

  test("defaults to blank screen", () => {
    expect(useNavStore.getState().screen).toBe("blank");
  });

  test("setScreen + goToSession + goToBlank update state", () => {
    useNavStore.getState().setScreen("editor");
    expect(useNavStore.getState().screen).toBe("editor");
    useNavStore.getState().goToBlank();
    expect(useNavStore.getState().screen).toBe("blank");
    useNavStore.getState().goToSession();
    expect(useNavStore.getState().screen).toBe("session");
  });

  test("toggleRailProject treats absent key as expanded=true and flips to false", () => {
    useNavStore.getState().toggleRailProject("proj-b");
    expect(useNavStore.getState().expandedProjectsRail["proj-b"]).toBe(false);
    useNavStore.getState().toggleRailProject("proj-b");
    expect(useNavStore.getState().expandedProjectsRail["proj-b"]).toBe(true);
  });

  test("rehydrate coerces transient screens to session", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          screen: "editor",
          expandedProjectsRail: {},
        },
        version: 0,
      }),
    );
    // Force a rehydrate.
    useNavStore.persist.rehydrate();
    expect(useNavStore.getState().screen).toBe("session");
  });

  test("rehydrate keeps blank and session as-is", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          screen: "blank",
          expandedProjectsRail: {},
        },
        version: 0,
      }),
    );
    useNavStore.persist.rehydrate();
    expect(useNavStore.getState().screen).toBe("blank");
  });

  test("rehydrate migrates legacy 'overview' route to 'blank'", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          screen: "overview",
          // Legacy field from the removed overview screen; must be ignored without errors.
          expandedProjectsOverview: { x: true },
          expandedProjectsRail: {},
        },
        version: 0,
      }),
    );
    useNavStore.persist.rehydrate();
    expect(useNavStore.getState().screen).toBe("blank");
  });
});
