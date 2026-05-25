import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "../../../test/utils";
import { useNavStore } from "../../lib/useNavStore";
import { PidSessionsList } from "./PidSessionsList";
import { useProjectsStore } from "./useProjectsStore";
import { useSessionsStore } from "./useSessionsStore";

const originalActivate = useSessionsStore.getState().activateSession;

beforeEach(() => {
  useNavStore.setState({
    screen: "blank",
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
    archivedSessions: [],
    archivedLoaded: true,
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

  test("archived sessions render in the ARCHIVE group, not their project group", () => {
    useSessionsStore.setState((prev) => ({
      ...prev,
      sessionsByProject: {
        "p-1": [
          {
            id: "row-1",
            projectId: "p-1",
            title: "Live row",
            lastActivityAt: "2026-05-16T11:50:00Z",
          },
          {
            id: "row-2",
            projectId: "p-1",
            title: "Old archived row",
            lastActivityAt: "2026-05-10T11:50:00Z",
            archived: true,
          },
        ],
      },
      archivedSessions: [
        {
          id: "row-2",
          projectId: "p-1",
          title: "Old archived row",
          lastActivityAt: "2026-05-10T11:50:00Z",
          archived: true,
        },
      ],
      archivedLoaded: true,
    }));
    // Expand both the project block and the archive block so all rows render.
    useNavStore.setState({
      screen: "blank",
      expandedProjectsOverview: {},
      expandedProjectsRail: { "p-1": true, __archive__: true },
    });

    render(<PidSessionsList />);

    // Live row only — the archived one is filtered out of its project group.
    const liveMatches = screen.getAllByText("Live row");
    expect(liveMatches.length).toBe(1);
    // Archived row appears under the synthetic ARCHIVE group instead. The "archive" label
    // sits in `.pid-rail-project-name`; use the class to disambiguate from "archived" text
    // inside the row title.
    expect(document.querySelector(".pid-rail-project-name")?.textContent).toBeTruthy();
    expect(
      [...document.querySelectorAll(".pid-rail-project-name")].some(
        (el) => el.textContent === "archive",
      ),
    ).toBe(true);
    expect(screen.getAllByText("Old archived row").length).toBe(1);
  });

  test("renders branch line in mono under the title when session.branch is set", () => {
    useSessionsStore.setState((prev) => ({
      ...prev,
      sessionsByProject: {
        "p-1": [
          {
            id: "row-1",
            projectId: "p-1",
            title: "Branchy row",
            branch: "pi/branchy",
            lastActivityAt: "2026-05-16T11:50:00Z",
          },
        ],
      },
    }));

    render(<PidSessionsList />);
    expect(screen.getByText("pi/branchy")).toBeInTheDocument();
  });

  test("collapses sessions past the 5-row cap behind an N MORE toggle", () => {
    const sessions = Array.from({ length: 8 }, (_, i) => ({
      id: `row-${i + 1}`,
      projectId: "p-1",
      title: `Session ${i + 1}`,
      lastActivityAt: "2026-05-16T11:50:00Z",
    }));
    useSessionsStore.setState((prev) => ({
      ...prev,
      sessionsByProject: { "p-1": sessions },
    }));
    useNavStore.setState({
      screen: "blank",
      expandedProjectsOverview: {},
      expandedProjectsRail: { "p-1": true },
    });

    render(<PidSessionsList />);

    // First 5 rows visible; rows 6-8 hidden behind the toggle.
    expect(screen.getByText("Session 1")).toBeInTheDocument();
    expect(screen.getByText("Session 5")).toBeInTheDocument();
    expect(screen.queryByText("Session 6")).toBeNull();
    expect(screen.queryByText("Session 8")).toBeNull();

    const toggle = screen.getByRole("button", { name: /3 more/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);

    // Expanded: every row visible, toggle flips to "show less".
    expect(screen.getByText("Session 6")).toBeInTheDocument();
    expect(screen.getByText("Session 8")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show less/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    // Clicking again re-collapses.
    fireEvent.click(screen.getByRole("button", { name: /show less/i }));
    expect(screen.queryByText("Session 6")).toBeNull();
  });

  test("keeps an active session visible even when it's past the cap", () => {
    const sessions = Array.from({ length: 8 }, (_, i) => ({
      id: `row-${i + 1}`,
      projectId: "p-1",
      title: `Session ${i + 1}`,
      lastActivityAt: "2026-05-16T11:50:00Z",
    }));
    useSessionsStore.setState((prev) => ({
      ...prev,
      sessionsByProject: { "p-1": sessions },
      activeSessionId: "row-7",
    }));
    useNavStore.setState({
      screen: "blank",
      expandedProjectsOverview: {},
      expandedProjectsRail: { "p-1": true },
    });

    render(<PidSessionsList />);

    // Active row (row-7) is in the collapsed tail but should still be rendered so the
    // focused row never vanishes from the rail.
    expect(screen.getByText("Session 7")).toBeInTheDocument();
    expect(screen.queryByText("Session 6")).toBeNull();
    expect(screen.queryByText("Session 8")).toBeNull();
  });

  test("no overflow toggle when the list fits within the cap", () => {
    const sessions = Array.from({ length: 3 }, (_, i) => ({
      id: `row-${i + 1}`,
      projectId: "p-1",
      title: `Session ${i + 1}`,
      lastActivityAt: "2026-05-16T11:50:00Z",
    }));
    useSessionsStore.setState((prev) => ({
      ...prev,
      sessionsByProject: { "p-1": sessions },
    }));
    useNavStore.setState({
      screen: "blank",
      expandedProjectsOverview: {},
      expandedProjectsRail: { "p-1": true },
    });

    render(<PidSessionsList />);
    expect(screen.queryByRole("button", { name: /more|show less/i })).toBeNull();
  });
});
