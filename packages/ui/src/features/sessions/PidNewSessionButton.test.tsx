import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "../../../test/utils";
import { useNavStore } from "../../lib/useNavStore";
import { PidNewSessionButton } from "./PidNewSessionButton";
import { useProjectsStore } from "./useProjectsStore";
import { useSessionsStore } from "./useSessionsStore";

const originalCreate = useSessionsStore.getState().createSession;

beforeEach(() => {
  useNavStore.setState({
    screen: "blank",
    expandedProjectsOverview: {},
    expandedProjectsRail: {},
  });
});

afterEach(() => {
  useSessionsStore.setState((prev) => ({ ...prev, createSession: originalCreate }));
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

  test("click creates a session in the active project and flips the screen", async () => {
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

    const create = mock((_id: string) => Promise.resolve());
    useSessionsStore.setState((prev) => ({ ...prev, createSession: create }));

    render(<PidNewSessionButton />);
    fireEvent.click(screen.getByRole("button", { name: /create new session/i }));

    expect(create).toHaveBeenCalledWith("p-1");
    // Wait a microtask so the .then handler runs.
    await Promise.resolve();
    expect(useNavStore.getState().screen).toBe("session");
  });
});
