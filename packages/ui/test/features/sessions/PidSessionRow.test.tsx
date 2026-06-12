import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { useMessagesStore } from "../../../src/features/chat/useMessagesStore";
import { PidSessionRow } from "../../../src/features/sessions/PidSessionRow";
import { __resetSessionWarmup } from "../../../src/features/sessions/sessionWarmup";
import { useSessionsStore } from "../../../src/features/sessions/useSessionsStore";
import { useNavStore } from "../../../src/lib/useNavStore";
import { fireEvent, render, screen } from "../../utils";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    expandedProjectsRail: {},
  });
  useSessionsStore.setState((prev) => ({
    ...prev,
    activeSessionId: undefined,
    client: undefined,
  }));
  useMessagesStore.setState({ bySession: {} });
  __resetSessionWarmup();
});

function installWarmClient() {
  const call = mock((_method: string, _input: unknown) => Promise.resolve({ ok: true }));
  useSessionsStore.setState((prev) => ({ ...prev, client: { call } as never }));
  return call;
}

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

  test("a deliberate hover warms the session's worker via session.activate", async () => {
    const call = installWarmClient();
    render(<PidSessionRow session={baseSession} active={false} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: /My session/ }));
    await wait(220);
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0]?.[0]).toBe("session.activate");
    expect(call.mock.calls[0]?.[1]).toEqual({ sessionId: "sess-1" });
  });

  test("leaving before the hover delay cancels the warm-up", async () => {
    const call = installWarmClient();
    render(<PidSessionRow session={baseSession} active={false} />);
    const button = screen.getByRole("button", { name: /My session/ });
    fireEvent.mouseEnter(button);
    fireEvent.mouseLeave(button);
    await wait(220);
    expect(call).not.toHaveBeenCalled();
  });

  test("does not warm the row that's already active", async () => {
    const call = installWarmClient();
    render(<PidSessionRow session={baseSession} active={true} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: /My session/ }));
    await wait(220);
    expect(call).not.toHaveBeenCalled();
  });
});
