import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "../../../test/utils";
import { useNavStore } from "../../lib/useNavStore";
import { useMessagesStore } from "../chat/useMessagesStore";
import { PidSessionRow } from "./PidSessionRow";
import { useSessionsStore } from "./useSessionsStore";

const baseSession = {
  id: "sess-1",
  projectId: "11111111-1111-4111-8111-111111111111",
  title: "My session",
  lastActivityAt: "2026-05-20T10:00:00Z",
};

// Snapshot the real action at module load so afterEach can put it back after we mock it.
// Otherwise the mocked function leaks into later tests in the same bun process.
const originalActivate = useSessionsStore.getState().activateSession;

beforeEach(() => {
  useNavStore.setState({
    screen: "blank",
    expandedProjectsOverview: {},
    expandedProjectsRail: {},
  });
  useSessionsStore.setState((prev) => ({
    ...prev,
    activeSessionId: undefined,
  }));
  useMessagesStore.setState({ bySession: {} });
});

afterEach(() => {
  useSessionsStore.setState((prev) => ({ ...prev, activateSession: originalActivate }));
});

describe("PidSessionRow", () => {
  test("renders title, branch and timestamp", () => {
    render(<PidSessionRow session={{ ...baseSession, branch: "pi/feature-x" }} active={false} />);
    expect(screen.getByText("My session")).toBeInTheDocument();
    expect(screen.getByText("pi/feature-x")).toBeInTheDocument();
  });

  test("omits the branch line when session.branch is absent", () => {
    render(<PidSessionRow session={baseSession} active={false} />);
    expect(screen.queryByText("pi/feature-x")).not.toBeInTheDocument();
  });

  test("click activates the session and flips nav to session route", () => {
    const activate = mock((id: string) => {
      useSessionsStore.setState((prev) => ({ ...prev, activeSessionId: id }));
      return Promise.resolve();
    });
    useSessionsStore.setState((prev) => ({ ...prev, activateSession: activate }));

    render(<PidSessionRow session={baseSession} active={false} />);
    fireEvent.click(screen.getByRole("button", { name: /My session/ }));

    expect(activate).toHaveBeenCalledWith("sess-1");
    expect(useNavStore.getState().screen).toBe("session");
  });

  test("active row carries aria-current=true", () => {
    render(<PidSessionRow session={baseSession} active={true} />);
    expect(screen.getByRole("button", { name: /My session/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  test("renders the lifecycle marker filled when active, hollow otherwise", () => {
    const { rerender } = render(<PidSessionRow session={baseSession} active={true} />);
    let marker = screen
      .getByRole("button", { name: /My session/ })
      .querySelector(".pid-rail-row-marker");
    expect(marker?.getAttribute("data-state")).toBe("active");

    rerender(<PidSessionRow session={baseSession} active={false} />);
    marker = screen
      .getByRole("button", { name: /My session/ })
      .querySelector(".pid-rail-row-marker");
    expect(marker?.getAttribute("data-state")).toBe("idle");
  });

  test("replaces the timestamp with a live dot when the session's turn is in flight", () => {
    useMessagesStore.setState({
      bySession: {
        "sess-1": { messages: [], toolCalls: {}, isTurnInFlight: true },
      },
    });
    render(<PidSessionRow session={baseSession} active={true} />);
    const live = screen.getByRole("status", { name: /running/i });
    expect(live).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /My session/ }).querySelector(".pid-rail-row-meta"),
    ).toBeNull();
  });

  test("shows the relative timestamp when not in flight", () => {
    useMessagesStore.setState({
      bySession: {
        "sess-1": { messages: [], toolCalls: {}, isTurnInFlight: false },
      },
    });
    render(<PidSessionRow session={baseSession} active={true} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      screen.getByRole("button", { name: /My session/ }).querySelector(".pid-rail-row-meta"),
    ).not.toBeNull();
  });
});
