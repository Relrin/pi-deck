import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { useNavStore } from "../../src/lib/useNavStore";

const STORAGE_KEY = "pi-deck:nav:v1";

function resetStore() {
  useNavStore.setState({
    screen: "blank",
    expandedProjectsOverview: {},
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

  test("toggleOverviewProject treats absent key as expanded=true and flips to false", () => {
    useNavStore.getState().toggleOverviewProject("proj-a");
    expect(useNavStore.getState().expandedProjectsOverview["proj-a"]).toBe(false);
    useNavStore.getState().toggleOverviewProject("proj-a");
    expect(useNavStore.getState().expandedProjectsOverview["proj-a"]).toBe(true);
  });

  test("toggleRailProject toggles independently of overview map", () => {
    useNavStore.getState().toggleRailProject("proj-b");
    expect(useNavStore.getState().expandedProjectsRail["proj-b"]).toBe(false);
    expect(useNavStore.getState().expandedProjectsOverview["proj-b"]).toBeUndefined();
  });

  test("rehydrate coerces transient screens to session", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          screen: "editor",
          expandedProjectsOverview: { x: false },
          expandedProjectsRail: {},
        },
        version: 0,
      }),
    );
    // Force a rehydrate.
    useNavStore.persist.rehydrate();
    expect(useNavStore.getState().screen).toBe("session");
    expect(useNavStore.getState().expandedProjectsOverview.x).toBe(false);
  });

  test("rehydrate keeps blank and session as-is", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          screen: "blank",
          expandedProjectsOverview: {},
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
          expandedProjectsOverview: { x: true },
          expandedProjectsRail: {},
        },
        version: 0,
      }),
    );
    useNavStore.persist.rehydrate();
    expect(useNavStore.getState().screen).toBe("blank");
    expect(useNavStore.getState().expandedProjectsOverview.x).toBe(true);
  });
});
