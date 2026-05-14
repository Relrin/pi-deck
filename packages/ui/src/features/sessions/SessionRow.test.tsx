import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "../../../test/utils";
import { SessionRow } from "./SessionRow";
import { useSessionsStore } from "./useSessionsStore";

const session = {
  id: "sess-1",
  projectId: "p-1",
  title: "My session",
  lastActivityAt: new Date(Date.now() - 60_000).toISOString(),
};

const ORIGINAL_ACTIVATE = useSessionsStore.getState().activateSession;

beforeEach(() => {
  useSessionsStore.setState({
    activeSessionId: undefined,
    activateSession: ORIGINAL_ACTIVATE,
  });
});

afterAll(() => {
  useSessionsStore.setState({ activateSession: ORIGINAL_ACTIVATE });
});

describe("SessionRow", () => {
  test("renders the session title and a relative time", () => {
    render(<SessionRow session={session} active={false} />);
    expect(screen.getByText("My session")).toBeInTheDocument();
    expect(screen.getByText("1m ago")).toBeInTheDocument();
  });

  test("active row has aria-current=true", () => {
    render(<SessionRow session={session} active={true} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-current", "true");
  });

  test("clicking the row calls activateSession with the row's id", () => {
    let activated: string | undefined;
    useSessionsStore.setState({
      activateSession: (async (id: string) => {
        activated = id;
      }) as never,
    });
    render(<SessionRow session={session} active={false} />);
    fireEvent.click(screen.getByRole("button"));
    expect(activated).toBe("sess-1");
  });
});
