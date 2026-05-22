import { beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "../../../test/utils";
import { useNavStore } from "../../lib/useNavStore";
import { PidNewSessionButton } from "./PidNewSessionButton";
import { useProjectsStore } from "./useProjectsStore";

beforeEach(() => {
  useNavStore.setState({
    screen: "session",
    expandedProjectsOverview: {},
    expandedProjectsRail: {},
  });
});

describe("PidNewSessionButton", () => {
  test("is disabled when there is no active project", () => {
    useProjectsStore.setState({
      projects: [],
      activeProjectId: undefined,
      lastActiveSessionByProject: {},
    });
    render(<PidNewSessionButton />);
    const button = screen.getByRole("button", { name: /open a project first/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  test("click routes to the blank/composer screen without creating a session", () => {
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

    render(<PidNewSessionButton />);
    fireEvent.click(screen.getByRole("button", { name: /new session/i }));

    expect(useNavStore.getState().screen).toBe("blank");
  });

  test("click is a no-op when there is no active project", () => {
    useProjectsStore.setState({
      projects: [],
      activeProjectId: undefined,
      lastActiveSessionByProject: {},
    });

    render(<PidNewSessionButton />);
    fireEvent.click(screen.getByRole("button", { name: /open a project first/i }));

    // No project → nav stays on whatever it was (still "session" from beforeEach).
    expect(useNavStore.getState().screen).toBe("session");
  });
});
