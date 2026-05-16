import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { renderHook } from "../../../test/utils";
import { useNavStore } from "../../lib/useNavStore";
import { useNewSessionShortcut } from "./useNewSessionShortcut";
import { useProjectsStore } from "./useProjectsStore";
import { useSessionsStore } from "./useSessionsStore";

const originalCreate = useSessionsStore.getState().createSession;

function dispatchCmdN(target?: EventTarget) {
  const event = new KeyboardEvent("keydown", {
    key: "n",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  if (target) {
    target.dispatchEvent(event);
  } else {
    window.dispatchEvent(event);
  }
  return event;
}

beforeEach(() => {
  useNavStore.setState({
    screen: "overview",
    expandedProjectsOverview: {},
    expandedProjectsRail: {},
  });
  useProjectsStore.setState({
    projects: [
      {
        id: "p-1",
        path: "/p/1",
        displayName: "Proj 1",
        lastOpenedAt: "2026-05-16T12:00:00Z",
      },
    ],
    activeProjectId: "p-1",
    lastActiveSessionByProject: {},
  });
});

afterEach(() => {
  useSessionsStore.setState((prev) => ({ ...prev, createSession: originalCreate }));
});

describe("useNewSessionShortcut", () => {
  test("Cmd/Ctrl+N creates a new session and flips screen", async () => {
    const create = mock((_id: string) => Promise.resolve());
    useSessionsStore.setState((prev) => ({ ...prev, createSession: create }));

    renderHook(() => useNewSessionShortcut());
    dispatchCmdN();

    expect(create).toHaveBeenCalledWith("p-1");
    await Promise.resolve();
    expect(useNavStore.getState().screen).toBe("session");
  });

  test("no-op when there is no active project", () => {
    useProjectsStore.setState({
      projects: [],
      activeProjectId: undefined,
      lastActiveSessionByProject: {},
    });
    const create = mock((_id: string) => Promise.resolve());
    useSessionsStore.setState((prev) => ({ ...prev, createSession: create }));

    renderHook(() => useNewSessionShortcut());
    dispatchCmdN();
    expect(create).not.toHaveBeenCalled();
  });

  test("suppressed when target is a textarea", () => {
    const create = mock((_id: string) => Promise.resolve());
    useSessionsStore.setState((prev) => ({ ...prev, createSession: create }));

    renderHook(() => useNewSessionShortcut());
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();
    dispatchCmdN(textarea);
    document.body.removeChild(textarea);

    expect(create).not.toHaveBeenCalled();
  });
});
