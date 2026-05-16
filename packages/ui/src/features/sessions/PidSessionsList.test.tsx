import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "../../../test/utils";
import { useNavStore } from "../../lib/useNavStore";
import { PidSessionsList } from "./PidSessionsList";
import { useProjectsStore } from "./useProjectsStore";
import { useSessionsStore } from "./useSessionsStore";

const originalActivate = useSessionsStore.getState().activateSession;

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
  useSessionsStore.setState((prev) => ({
    ...prev,
    sessions: [],
    activeSessionId: undefined,
    sessionsByProject: {
      "p-1": [
        {
          id: "row-1",
          projectId: "p-1",
          title: "Hello row",
          model: "claude-sonnet-4-6",
          lastActivityAt: "2026-05-16T11:50:00Z",
        },
      ],
    },
    loadingByProject: {},
    errorByProject: {},
  }));
});

afterEach(() => {
  useSessionsStore.setState((prev) => ({ ...prev, activateSession: originalActivate }));
});

describe("PidSessionsList", () => {
  test("renders project block with cached sessions", () => {
    render(<PidSessionsList />);
    expect(screen.getByText("Proj 1")).toBeInTheDocument();
    expect(screen.getByText("Hello row")).toBeInTheDocument();
  });

  test("clicking a row activates session and flips screen to session", () => {
    const activate = mock((id: string) => {
      useSessionsStore.setState((prev) => ({ ...prev, activeSessionId: id }));
      return Promise.resolve();
    });
    useSessionsStore.setState((prev) => ({ ...prev, activateSession: activate }));

    render(<PidSessionsList />);
    fireEvent.click(screen.getByRole("button", { name: /Hello row/ }));
    expect(activate).toHaveBeenCalledWith("row-1");
    expect(useNavStore.getState().screen).toBe("session");
  });
});
