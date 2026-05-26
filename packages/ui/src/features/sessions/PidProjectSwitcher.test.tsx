import { beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "../../../test/utils";
import { useNavStore } from "../../lib/useNavStore";
import { PidProjectSwitcher } from "./PidProjectSwitcher";
import { useSessionsStore } from "./useSessionsStore";

const project = {
  id: "p-x",
  path: "/p/x",
  displayName: "Proj X",
  lastOpenedAt: "2026-05-16T12:00:00Z",
};

beforeEach(() => {
  useNavStore.setState({
    screen: "blank",
    expandedProjectsOverview: {},
    expandedProjectsRail: {},
  });
  useSessionsStore.setState((prev) => ({
    ...prev,
    activeSessionId: undefined,
    sessionsByProject: {},
  }));
});

describe("PidProjectSwitcher", () => {
  test("toggling persists expand state in the nav store", () => {
    render(<PidProjectSwitcher project={project} count={3} />);
    const header = screen.getByRole("button", { name: /Proj X/ });
    // Default expanded=true (key absent).
    expect(header.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(header);
    expect(useNavStore.getState().expandedProjectsRail["p-x"]).toBe(false);
    fireEvent.click(header);
    expect(useNavStore.getState().expandedProjectsRail["p-x"]).toBe(true);
  });

  test("renders count when provided", () => {
    render(<PidProjectSwitcher project={project} count={7} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  test("caret icon flips with the expanded state", () => {
    const { rerender } = render(<PidProjectSwitcher project={project} count={3} />);
    // Expanded: Lucide ChevronDown (class includes `lucide-chevron-down`).
    expect(
      screen
        .getByRole("button", { name: /Proj X/ })
        .querySelector(".pid-rail-project-caret .lucide-chevron-down"),
    ).not.toBeNull();
    useNavStore.setState((prev) => ({
      ...prev,
      expandedProjectsRail: { "p-x": false },
    }));
    rerender(<PidProjectSwitcher project={project} count={3} />);
    // Collapsed: Lucide ChevronRight.
    expect(
      screen
        .getByRole("button", { name: /Proj X/ })
        .querySelector(".pid-rail-project-caret .lucide-chevron-right"),
    ).not.toBeNull();
  });

  test("square lights up (data-active=true) when this project hosts the active session", () => {
    useSessionsStore.setState((prev) => ({
      ...prev,
      activeSessionId: "s-1",
      sessionsByProject: {
        "p-x": [
          { id: "s-1", projectId: "p-x", title: "S1", lastActivityAt: "2026-05-16T11:50:00Z" },
        ],
      },
    }));
    render(<PidProjectSwitcher project={project} count={1} />);
    expect(screen.getByRole("button", { name: /Proj X/ })).toHaveAttribute("data-active", "true");
  });

  test("no data-active when the active session lives in a different project", () => {
    useSessionsStore.setState((prev) => ({
      ...prev,
      activeSessionId: "s-other",
      sessionsByProject: {
        "p-x": [
          { id: "s-1", projectId: "p-x", title: "S1", lastActivityAt: "2026-05-16T11:50:00Z" },
        ],
        "p-y": [
          {
            id: "s-other",
            projectId: "p-y",
            title: "Other",
            lastActivityAt: "2026-05-16T11:50:00Z",
          },
        ],
      },
    }));
    render(<PidProjectSwitcher project={project} count={1} />);
    expect(screen.getByRole("button", { name: /Proj X/ })).not.toHaveAttribute("data-active");
  });
});
