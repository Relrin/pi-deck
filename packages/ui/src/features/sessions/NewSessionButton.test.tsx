import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "../../../test/utils";
import { NewSessionButton } from "./NewSessionButton";
import { useProjectsStore } from "./useProjectsStore";
import { useSessionsStore } from "./useSessionsStore";

const ORIGINAL_CREATE = useSessionsStore.getState().createSession;

beforeEach(() => {
  useProjectsStore.setState({
    projects: [],
    activeProjectId: undefined,
    lastActiveSessionByProject: {},
  });
  useSessionsStore.setState({ createSession: ORIGINAL_CREATE });
});

afterAll(() => {
  useSessionsStore.setState({ createSession: ORIGINAL_CREATE });
});

describe("NewSessionButton", () => {
  test("disabled when no active project", () => {
    render(<NewSessionButton />);
    expect(screen.getByRole("button", { name: /open a project/i })).toBeDisabled();
  });

  test("enabled and calls createSession when a project is active", () => {
    let calledWith: string | undefined;
    useProjectsStore.setState({ activeProjectId: "proj-1" });
    useSessionsStore.setState({
      createSession: (async (id: string) => {
        calledWith = id;
      }) as never,
    });

    render(<NewSessionButton />);
    const btn = screen.getByRole("button", { name: "New session" });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(calledWith).toBe("proj-1");
  });
});
