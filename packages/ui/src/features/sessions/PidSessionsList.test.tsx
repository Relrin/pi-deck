import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen } from "../../../test/utils";
import { useNavStore } from "../../lib/useNavStore";
import { PidSessionsList } from "./PidSessionsList";
import { useProjectsStore } from "./useProjectsStore";
import { useSessionsFilterStore } from "./useSessionsFilterStore";
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
  // Tests below use hardcoded dates ("2026-05-16") that fall outside the default 7-day
  // "since" window from today's clock. Reset to defaults, then disable the cutoff so the
  // fixtures stay reachable.
  useSessionsFilterStore.getState().reset();
  useSessionsFilterStore.getState().setSince("all");
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

  test("sorts session rows by lastActivityAt, newest first", () => {
    useSessionsStore.setState((prev) => ({
      ...prev,
      sessionsByProject: {
        "p-1": [
          {
            id: "old",
            projectId: "p-1",
            title: "Older session",
            lastActivityAt: "2026-05-10T10:00:00Z",
          },
          {
            id: "newest",
            projectId: "p-1",
            title: "Newest session",
            lastActivityAt: "2026-05-20T10:00:00Z",
          },
          {
            id: "middle",
            projectId: "p-1",
            title: "Middle session",
            lastActivityAt: "2026-05-15T10:00:00Z",
          },
        ],
      },
    }));
    useNavStore.setState({
      screen: "blank",
      expandedProjectsOverview: {},
      expandedProjectsRail: { "p-1": true },
    });

    render(<PidSessionsList />);

    const titles = [...document.querySelectorAll(".pid-rail-row-title")].map(
      (el) => el.textContent,
    );
    expect(titles).toEqual(["Newest session", "Middle session", "Older session"]);
  });

  test("bumpLastActivity moves the bumped session to the top of the rail", () => {
    useSessionsStore.setState((prev) => ({
      ...prev,
      sessionsByProject: {
        "p-1": [
          {
            id: "a",
            projectId: "p-1",
            title: "A",
            lastActivityAt: "2026-05-20T10:00:00Z",
          },
          {
            id: "b",
            projectId: "p-1",
            title: "B",
            lastActivityAt: "2026-05-19T10:00:00Z",
          },
          {
            id: "c",
            projectId: "p-1",
            title: "C",
            lastActivityAt: "2026-05-18T10:00:00Z",
          },
        ],
      },
    }));
    useNavStore.setState({
      screen: "blank",
      expandedProjectsOverview: {},
      expandedProjectsRail: { "p-1": true },
    });

    const { rerender } = render(<PidSessionsList />);
    expect(
      [...document.querySelectorAll(".pid-rail-row-title")].map((el) => el.textContent),
    ).toEqual(["A", "B", "C"]);

    // Bump "C" — it should now sort to the very top.
    useSessionsStore.getState().bumpLastActivity("c");
    rerender(<PidSessionsList />);
    expect(
      [...document.querySelectorAll(".pid-rail-row-title")].map((el) => el.textContent),
    ).toEqual(["C", "A", "B"]);
  });

  test("filter store: Since cutoff hides rows older than the threshold", () => {
    // "today" is 2026-05-25 per the test environment. Use lastActivityAt values that
    // straddle the 1-day cutoff so the test is deterministic without mocking the clock.
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
    const stale = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5d ago
    useSessionsStore.setState((prev) => ({
      ...prev,
      sessionsByProject: {
        "p-1": [
          { id: "fresh", projectId: "p-1", title: "Fresh row", lastActivityAt: recent },
          { id: "old", projectId: "p-1", title: "Stale row", lastActivityAt: stale },
        ],
      },
    }));
    useNavStore.setState({
      screen: "blank",
      expandedProjectsOverview: {},
      expandedProjectsRail: { "p-1": true },
    });

    // 1d window: only the fresh row survives.
    useSessionsFilterStore.getState().setSince("1d");
    render(<PidSessionsList />);
    expect(screen.getByText("Fresh row")).toBeInTheDocument();
    expect(screen.queryByText("Stale row")).toBeNull();
  });

  test("filter store: Project subset hides project blocks not in the selection", () => {
    useProjectsStore.setState({
      projects: [
        {
          id: "p-1",
          path: "/p/1",
          displayName: "Proj 1",
          lastOpenedAt: "2026-05-16T12:00:00Z",
        },
        {
          id: "p-2",
          path: "/p/2",
          displayName: "Proj 2",
          lastOpenedAt: "2026-05-15T12:00:00Z",
        },
      ],
      activeProjectId: "p-1",
      lastActiveSessionByProject: {},
    });

    // Hide p-2 by selecting only p-1.
    useSessionsFilterStore.getState().setProject({ kind: "subset", ids: ["p-1"] });
    render(<PidSessionsList />);

    expect(screen.queryByText("Proj 1")).toBeInTheDocument();
    expect(screen.queryByText("Proj 2")).toBeNull();
  });

  test("filter store: Sort=created reorders rows by createdAt, falling back to lastActivityAt", () => {
    useSessionsStore.setState((prev) => ({
      ...prev,
      sessionsByProject: {
        "p-1": [
          // Active recently but created earliest.
          {
            id: "old-created",
            projectId: "p-1",
            title: "Old creation",
            createdAt: "2026-04-01T10:00:00Z",
            lastActivityAt: "2026-05-20T10:00:00Z",
          },
          // Active less recently but created latest.
          {
            id: "new-created",
            projectId: "p-1",
            title: "New creation",
            createdAt: "2026-05-19T10:00:00Z",
            lastActivityAt: "2026-05-15T10:00:00Z",
          },
        ],
      },
    }));
    useNavStore.setState({
      screen: "blank",
      expandedProjectsOverview: {},
      expandedProjectsRail: { "p-1": true },
    });

    useSessionsFilterStore.getState().setSort("created");
    render(<PidSessionsList />);

    const titles = [...document.querySelectorAll(".pid-rail-row-title")].map(
      (el) => el.textContent,
    );
    expect(titles).toEqual(["New creation", "Old creation"]);
  });

  test("filter store: search query filters by title or branch substring", async () => {
    useSessionsStore.setState((prev) => ({
      ...prev,
      sessionsByProject: {
        "p-1": [
          {
            id: "row-a",
            projectId: "p-1",
            title: "Auth refactor",
            branch: "pi/auth-rebuild",
            lastActivityAt: "2026-05-16T11:50:00Z",
          },
          {
            id: "row-b",
            projectId: "p-1",
            title: "Diff heatmap",
            branch: "pi/diff",
            lastActivityAt: "2026-05-16T11:50:00Z",
          },
        ],
      },
    }));
    useNavStore.setState({
      screen: "blank",
      expandedProjectsOverview: {},
      expandedProjectsRail: { "p-1": true },
    });

    const user = userEvent.setup();
    render(<PidSessionsList />);

    // No query: both visible.
    expect(screen.getByText("Auth refactor")).toBeInTheDocument();
    expect(screen.getByText("Diff heatmap")).toBeInTheDocument();

    // Type "heat" into the filter input — only the matching row stays.
    await user.type(screen.getByLabelText("Filter sessions") as HTMLInputElement, "heat");
    expect(screen.queryByText("Auth refactor")).toBeNull();
    expect(screen.getByText("Diff heatmap")).toBeInTheDocument();
  });

  test("group=flat renders a single ungrouped list, no project headers", () => {
    useProjectsStore.setState({
      projects: [
        {
          id: "p-1",
          path: "/p/1",
          displayName: "Alpha",
          lastOpenedAt: "2026-05-16T12:00:00Z",
        },
        {
          id: "p-2",
          path: "/p/2",
          displayName: "Beta",
          lastOpenedAt: "2026-05-15T12:00:00Z",
        },
      ],
      activeProjectId: "p-1",
      lastActiveSessionByProject: {},
    });
    useSessionsStore.setState((prev) => ({
      ...prev,
      sessionsByProject: {
        "p-1": [
          {
            id: "a1",
            projectId: "p-1",
            title: "Alpha first",
            lastActivityAt: "2026-05-20T10:00:00Z",
          },
        ],
        "p-2": [
          {
            id: "b1",
            projectId: "p-2",
            title: "Beta first",
            lastActivityAt: "2026-05-19T10:00:00Z",
          },
        ],
      },
    }));

    useSessionsFilterStore.getState().setGroup("flat");
    render(<PidSessionsList />);

    // No project headers rendered in flat mode.
    expect(document.querySelectorAll(".pid-rail-project-name").length).toBe(0);

    // All non-archived sessions appear, sorted by recency.
    const titles = [...document.querySelectorAll(".pid-rail-row-title")].map(
      (el) => el.textContent,
    );
    expect(titles).toEqual(["Alpha first", "Beta first"]);
  });

  test("group=flat respects the Project filter (hides sessions of unselected projects)", () => {
    useProjectsStore.setState({
      projects: [
        {
          id: "p-1",
          path: "/p/1",
          displayName: "Alpha",
          lastOpenedAt: "2026-05-16T12:00:00Z",
        },
        {
          id: "p-2",
          path: "/p/2",
          displayName: "Beta",
          lastOpenedAt: "2026-05-15T12:00:00Z",
        },
      ],
      activeProjectId: "p-1",
      lastActiveSessionByProject: {},
    });
    useSessionsStore.setState((prev) => ({
      ...prev,
      sessionsByProject: {
        "p-1": [
          {
            id: "a1",
            projectId: "p-1",
            title: "Alpha row",
            lastActivityAt: "2026-05-20T10:00:00Z",
          },
        ],
        "p-2": [
          {
            id: "b1",
            projectId: "p-2",
            title: "Beta row",
            lastActivityAt: "2026-05-19T10:00:00Z",
          },
        ],
      },
    }));

    useSessionsFilterStore.getState().setGroup("flat");
    useSessionsFilterStore.getState().setProject({ kind: "subset", ids: ["p-1"] });
    render(<PidSessionsList />);

    expect(screen.getByText("Alpha row")).toBeInTheDocument();
    expect(screen.queryByText("Beta row")).toBeNull();
  });

  test("group=flat hides archived sessions from the main list (archive bucket stays separate)", () => {
    useSessionsStore.setState((prev) => ({
      ...prev,
      sessionsByProject: {
        "p-1": [
          {
            id: "live",
            projectId: "p-1",
            title: "Live row",
            lastActivityAt: "2026-05-20T10:00:00Z",
          },
          {
            id: "old",
            projectId: "p-1",
            title: "Archived row",
            lastActivityAt: "2026-05-15T10:00:00Z",
            archived: true,
          },
        ],
      },
      archivedSessions: [
        {
          id: "old",
          projectId: "p-1",
          title: "Archived row",
          lastActivityAt: "2026-05-15T10:00:00Z",
          archived: true,
        },
      ],
      archivedLoaded: true,
    }));
    useNavStore.setState({
      screen: "blank",
      expandedProjectsOverview: {},
      expandedProjectsRail: { __archive__: false },
    });

    useSessionsFilterStore.getState().setGroup("flat");
    render(<PidSessionsList />);

    // Live row in the flat list.
    expect(screen.getByText("Live row")).toBeInTheDocument();
    // Archived row not duplicated into the flat list (still reachable inside the archive
    // bucket, which is collapsed here).
    expect(screen.queryByText("Archived row")).toBeNull();
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
