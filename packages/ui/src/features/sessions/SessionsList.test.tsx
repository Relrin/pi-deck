import { beforeEach, describe, expect, test } from "bun:test";
import { render, screen } from "../../../test/utils";
import { SessionsList } from "./SessionsList";
import { useProjectsStore } from "./useProjectsStore";
import { useSessionsStore } from "./useSessionsStore";

function resetStores() {
  useProjectsStore.setState({
    projects: [],
    activeProjectId: undefined,
    lastActiveSessionByProject: {},
  });
  useSessionsStore.setState({
    sessions: [],
    activeSessionId: undefined,
    isRefreshing: false,
    client: undefined,
  });
}

describe("SessionsList", () => {
  beforeEach(resetStores);

  test("empty state with no project", () => {
    render(<SessionsList />);
    expect(screen.getByText("No project open")).toBeInTheDocument();
  });

  test("empty state with project but no sessions", () => {
    useProjectsStore.setState({ activeProjectId: "p-1" });
    render(<SessionsList />);
    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
  });

  test("renders rows sorted by lastActivityAt descending", () => {
    const now = Date.now();
    useProjectsStore.setState({ activeProjectId: "p-1" });
    useSessionsStore.setState({
      sessions: [
        {
          id: "older",
          projectId: "p-1",
          title: "Older",
          lastActivityAt: new Date(now - 3600_000).toISOString(),
        },
        {
          id: "newer",
          projectId: "p-1",
          title: "Newer",
          lastActivityAt: new Date(now - 60_000).toISOString(),
        },
      ],
    });
    render(<SessionsList />);
    const titles = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    const indexNewer = titles.findIndex((t) => t.includes("Newer"));
    const indexOlder = titles.findIndex((t) => t.includes("Older"));
    expect(indexNewer).toBeGreaterThanOrEqual(0);
    expect(indexOlder).toBeGreaterThanOrEqual(0);
    expect(indexNewer).toBeLessThan(indexOlder);
  });

  test("shows a refreshing spinner when isRefreshing is true", () => {
    useProjectsStore.setState({ activeProjectId: "p-1" });
    useSessionsStore.setState({ isRefreshing: true });
    render(<SessionsList />);
    expect(screen.getByLabelText("Refreshing sessions")).toBeInTheDocument();
  });
});
