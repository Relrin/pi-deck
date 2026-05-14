import { beforeEach, describe, expect, test } from "bun:test";
import { render, screen } from "../../../../test/utils";
import { useMessagesStore } from "../useMessagesStore";
import { useUsageStore } from "../useUsageStore";
import { ContextUsageIndicator } from "./ContextUsageIndicator";

const SID = "session-1";

beforeEach(() => {
  useUsageStore.setState({ bySession: {} });
  useMessagesStore.setState({ bySession: {} });
});

describe("ContextUsageIndicator", () => {
  test("shows 0% before the first turn", () => {
    render(<ContextUsageIndicator sessionId={SID} />);
    expect(screen.getByRole("button", { name: /Context usage: 0%/i })).toBeInTheDocument();
  });

  test("shows the percent derived from useUsageStore.context.tokens / contextWindow", () => {
    useUsageStore
      .getState()
      .setTurnUsage(
        SID,
        { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        { tokens: 50_000, contextWindow: 200_000, percent: 0.25 },
      );
    render(<ContextUsageIndicator sessionId={SID} />);
    expect(screen.getByRole("button", { name: /Context usage: 25%/i })).toBeInTheDocument();
  });

  test("clamps to 100% if tokens exceed the context window", () => {
    useUsageStore
      .getState()
      .setTurnUsage(
        SID,
        { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        { tokens: 300_000, contextWindow: 200_000, percent: 1.5 },
      );
    render(<ContextUsageIndicator sessionId={SID} />);
    expect(screen.getByRole("button", { name: /Context usage: 100%/i })).toBeInTheDocument();
  });
});
