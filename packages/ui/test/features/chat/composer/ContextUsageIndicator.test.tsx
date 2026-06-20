import { beforeEach, describe, expect, test } from "bun:test";
import { ContextUsageIndicator } from "../../../../src/features/chat/composer/ContextUsageIndicator";
import { useMessagesStore } from "../../../../src/features/chat/useMessagesStore";
import { useUsageStore } from "../../../../src/features/chat/useUsageStore";
import { render, screen } from "../../../utils";

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

  test("an MCP estimate does not inflate the headline percent (it only re-slices `used`)", () => {
    useUsageStore.getState().setMcpUsage(SID, { tokens: 8_000, toolCount: 4 });
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
});

describe("useUsageStore — MCP usage", () => {
  test("setMcpUsage and setTurnUsage preserve one another", () => {
    useUsageStore.getState().setMcpUsage(SID, { tokens: 1_200, toolCount: 3 });
    useUsageStore
      .getState()
      .setTurnUsage(
        SID,
        { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, total: 3 },
        { tokens: 10_000, contextWindow: 200_000, percent: 0.05 },
      );

    const entry = useUsageStore.getState().bySession[SID];
    // The MCP estimate survives the turn, and the turn's context lands intact.
    expect(entry?.mcp).toEqual({ tokens: 1_200, toolCount: 3 });
    expect(entry?.context?.tokens).toBe(10_000);

    // A later MCP push keeps the most recent turn/context.
    useUsageStore.getState().setMcpUsage(SID, { tokens: 1_500, toolCount: 4 });
    const after = useUsageStore.getState().bySession[SID];
    expect(after?.mcp).toEqual({ tokens: 1_500, toolCount: 4 });
    expect(after?.context?.tokens).toBe(10_000);
  });
});
