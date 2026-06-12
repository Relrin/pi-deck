import { beforeEach, describe, expect, test } from "bun:test";
import { useNewSessionShortcut } from "../../../src/features/sessions/useNewSessionShortcut";
import { useProjectsStore } from "../../../src/features/sessions/useProjectsStore";
import { useNavStore } from "../../../src/lib/useNavStore";
import { renderHook } from "../../utils";

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
    screen: "session",
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

describe("useNewSessionShortcut", () => {
  test("Cmd/Ctrl+N routes to the blank/composer screen", () => {
    renderHook(() => useNewSessionShortcut());
    dispatchCmdN();

    expect(useNavStore.getState().screen).toBe("blank");
  });

  test("no-op when there is no active project", () => {
    useProjectsStore.setState({
      projects: [],
      activeProjectId: undefined,
      lastActiveSessionByProject: {},
    });

    renderHook(() => useNewSessionShortcut());
    dispatchCmdN();
    expect(useNavStore.getState().screen).toBe("session");
  });

  test("suppressed when target is a textarea", () => {
    renderHook(() => useNewSessionShortcut());
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();
    dispatchCmdN(textarea);
    document.body.removeChild(textarea);

    expect(useNavStore.getState().screen).toBe("session");
  });
});
