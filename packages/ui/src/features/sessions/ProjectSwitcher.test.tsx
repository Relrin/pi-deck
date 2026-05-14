import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { render, screen } from "../../../test/utils";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { useProjectsStore } from "./useProjectsStore";
import { useSessionsStore } from "./useSessionsStore";

const ORIGINAL_OPEN_BY_PATH = useProjectsStore.getState().openProjectByPath;

beforeEach(() => {
  useProjectsStore.setState({
    projects: [],
    activeProjectId: undefined,
    lastActiveSessionByProject: {},
    openProjectByPath: ORIGINAL_OPEN_BY_PATH,
  });
  useSessionsStore.setState({ client: undefined });
});

afterAll(() => {
  useProjectsStore.setState({ openProjectByPath: ORIGINAL_OPEN_BY_PATH });
});

describe("ProjectSwitcher", () => {
  test("renders 'Open folder…' label when no project is active", () => {
    render(<ProjectSwitcher />);
    expect(screen.getByText("Open folder…")).toBeInTheDocument();
  });

  test("shows the active project's displayName when one is set", () => {
    useProjectsStore.setState({
      projects: [
        {
          id: "p-1",
          path: "/x/y",
          displayName: "Demo",
          lastOpenedAt: new Date().toISOString(),
        },
      ],
      activeProjectId: "p-1",
    });
    render(<ProjectSwitcher />);
    expect(screen.getByText("Demo")).toBeInTheDocument();
  });

  test("trigger button exposes the project path as a hover title", () => {
    useProjectsStore.setState({
      projects: [
        {
          id: "p-1",
          path: "/some/long/path",
          displayName: "Project",
          lastOpenedAt: new Date().toISOString(),
        },
      ],
      activeProjectId: "p-1",
    });
    render(<ProjectSwitcher />);
    expect(screen.getByRole("button")).toHaveAttribute("title", "/some/long/path");
  });
});
