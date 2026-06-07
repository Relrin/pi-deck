import { beforeEach, describe, expect, test } from "bun:test";
import { useProjectsStore } from "../../../src/features/sessions/useProjectsStore";

beforeEach(() => {
  useProjectsStore.setState({
    projects: [],
    activeProjectId: undefined,
    lastActiveSessionByProject: {},
  });
});

describe("useProjectsStore", () => {
  test("setActive updates the active project id", () => {
    useProjectsStore.getState().setActive("proj-1");
    expect(useProjectsStore.getState().activeProjectId).toBe("proj-1");
    useProjectsStore.getState().setActive(undefined);
    expect(useProjectsStore.getState().activeProjectId).toBeUndefined();
  });

  test("setLastActiveSession persists per-project memory", () => {
    useProjectsStore.getState().setLastActiveSession("proj-1", "sess-a");
    useProjectsStore.getState().setLastActiveSession("proj-2", "sess-b");
    expect(useProjectsStore.getState().lastActiveSessionByProject).toEqual({
      "proj-1": "sess-a",
      "proj-2": "sess-b",
    });
  });

  test("setLastActiveSession(undefined) clears the memory for one project", () => {
    useProjectsStore.getState().setLastActiveSession("proj-1", "sess-a");
    useProjectsStore.getState().setLastActiveSession("proj-2", "sess-b");
    useProjectsStore.getState().setLastActiveSession("proj-1", undefined);
    expect(useProjectsStore.getState().lastActiveSessionByProject).toEqual({
      "proj-2": "sess-b",
    });
  });
});
