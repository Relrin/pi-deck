import { beforeEach, describe, expect, test } from "bun:test";
import { useMessagesStore } from "../../src/features/chat/useMessagesStore";
import { useSessionsStore } from "../../src/features/sessions/useSessionsStore";
import { PidCenterRouter } from "../../src/layout/PidCenterRouter";
import { useNavStore } from "../../src/lib/useNavStore";
import { render, screen } from "../utils";

const SID = "sess-1";

beforeEach(() => {
  useNavStore.setState({ screen: "session" });
  useSessionsStore.setState((prev) => ({ ...prev, activeSessionId: SID }));
  useMessagesStore.setState({ bySession: {} });
});

describe("PidCenterRouter — session loading state", () => {
  test("shows a loading state (not the empty intro) while history hasn't loaded", () => {
    // No bySession entry → transcript not fetched yet (cold worker spawn in flight).
    render(<PidCenterRouter />);
    expect(screen.getByText("Loading session…")).toBeInTheDocument();
  });

  test("drops the loader once history loads, even when the transcript is empty", () => {
    useMessagesStore.getState().loadHistory(SID, { messages: [], toolCalls: {} });
    render(<PidCenterRouter />);
    expect(screen.queryByText("Loading session…")).not.toBeInTheDocument();
  });
});
