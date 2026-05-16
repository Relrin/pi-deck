import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render, screen } from "../../../../test/utils";
import { useNavStore } from "../../../lib/useNavStore";
import { useProjectsStore } from "../useProjectsStore";
import { useSessionsStore } from "../useSessionsStore";
import { PidSessionsOverview } from "./PidSessionsOverview";

const originalActivate = useSessionsStore.getState().activateSession;
const originalLoad = useSessionsStore.getState().loadProjectSessions;

function seedProjects() {
  useProjectsStore.setState({
    projects: [
      {
        id: "p-a",
        path: "/p/a",
        displayName: "Project A",
        lastOpenedAt: "2026-05-16T12:00:00Z",
      },
      {
        id: "p-b",
        path: "/p/b",
        displayName: "Project B",
        lastOpenedAt: "2026-05-16T11:00:00Z",
      },
    ],
    activeProjectId: "p-a",
    lastActiveSessionByProject: {},
  });
}

function seedCachedA() {
  useSessionsStore.setState((prev) => ({
    ...prev,
    sessions: [
      {
        id: "s-1",
        projectId: "p-a",
        title: "Refactor sidebar",
        model: "claude-sonnet-4-6",
        lastActivityAt: "2026-05-16T11:30:00Z",
      },
      {
        id: "s-2",
        projectId: "p-a",
        title: "Plan mode",
        model: "claude-sonnet-4-6",
        lastActivityAt: "2026-05-16T11:00:00Z",
      },
    ],
    activeSessionId: undefined,
    sessionsByProject: {
      "p-a": [
        {
          id: "s-1",
          projectId: "p-a",
          title: "Refactor sidebar",
          model: "claude-sonnet-4-6",
          lastActivityAt: "2026-05-16T11:30:00Z",
        },
        {
          id: "s-2",
          projectId: "p-a",
          title: "Plan mode",
          model: "claude-sonnet-4-6",
          lastActivityAt: "2026-05-16T11:00:00Z",
        },
      ],
    },
    loadingByProject: {},
    errorByProject: {},
  }));
}

beforeEach(() => {
  // Make sure no leftover effect chain can fire across tests: replace loadProjectSessions
  // with a deterministic mock that mutates the cache so the useEffect's guards short-circuit
  // on the next render and the chain terminates.
  const defaultLoad = mock((projectId: string) => {
    useSessionsStore.setState((prev) => ({
      ...prev,
      sessionsByProject: { ...prev.sessionsByProject, [projectId]: [] },
      loadingByProject: { ...prev.loadingByProject, [projectId]: false },
    }));
    return Promise.resolve();
  });

  useNavStore.setState({
    screen: "overview",
    // Collapse both project sections by default so no useEffect side-effect fires on mount.
    // Each test that needs an expand will toggle explicitly via the section header.
    expandedProjectsOverview: { "p-a": false, "p-b": false },
    expandedProjectsRail: {},
  });

  seedProjects();
  seedCachedA();

  useSessionsStore.setState((prev) => ({ ...prev, loadProjectSessions: defaultLoad }));
});

afterEach(() => {
  useSessionsStore.setState((prev) => ({
    ...prev,
    activateSession: originalActivate,
    loadProjectSessions: originalLoad,
  }));
});

describe("PidSessionsOverview", () => {
  test("renders heading with total count and project sections", () => {
    render(<PidSessionsOverview />);
    expect(screen.getByText(/all sessions/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Project A/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Project B/ })).toBeInTheDocument();
    // Sections are collapsed → cards not rendered yet.
    expect(screen.queryByText("Refactor sidebar")).toBeNull();
  });

  test("expanding a cached section reveals its cards without re-fetching", () => {
    const load = mock((_id: string) => Promise.resolve());
    useSessionsStore.setState((prev) => ({ ...prev, loadProjectSessions: load }));

    render(<PidSessionsOverview />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Project A/ }));
    });

    expect(screen.getByText("Refactor sidebar")).toBeInTheDocument();
    expect(load).not.toHaveBeenCalled();
  });

  test("expanding an uncached section triggers loadProjectSessions for that project only", () => {
    const load = mock((projectId: string) => {
      useSessionsStore.setState((prev) => ({
        ...prev,
        sessionsByProject: { ...prev.sessionsByProject, [projectId]: [] },
      }));
      return Promise.resolve();
    });
    useSessionsStore.setState((prev) => ({ ...prev, loadProjectSessions: load }));

    render(<PidSessionsOverview />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Project B/ }));
    });

    expect(load.mock.calls.map((c) => c[0])).toEqual(["p-b"]);
  });

  test("clicking a session card activates it and flips screen to session", () => {
    const activate = mock((id: string) => {
      useSessionsStore.setState((prev) => ({ ...prev, activeSessionId: id }));
      return Promise.resolve();
    });
    useSessionsStore.setState((prev) => ({ ...prev, activateSession: activate }));

    render(<PidSessionsOverview />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Project A/ }));
    });
    fireEvent.click(screen.getByRole("button", { name: /Refactor sidebar/ }));
    expect(activate).toHaveBeenCalledWith("s-1");
    expect(useNavStore.getState().screen).toBe("session");
  });

  test("zero projects renders the intro fullscreen", () => {
    useProjectsStore.setState({
      projects: [],
      activeProjectId: undefined,
      lastActiveSessionByProject: {},
    });
    useSessionsStore.setState((prev) => ({
      ...prev,
      sessions: [],
      sessionsByProject: {},
      loadingByProject: {},
      errorByProject: {},
    }));
    render(<PidSessionsOverview />);
    expect(screen.getByText("what are we shipping today?")).toBeInTheDocument();
  });
});
