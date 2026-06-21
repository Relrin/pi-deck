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

  test("the overhead estimate does not inflate the headline percent (it only re-slices `used`)", () => {
    useUsageStore.getState().setContextCost(SID, {
      systemPrompt: 1_500,
      projectContext: 1_000,
      builtinTools: 4_500,
      mcp: 8_000,
      mcpToolCount: 4,
    });
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

describe("useUsageStore — context cost", () => {
  test("setContextCost and setTurnUsage preserve one another", () => {
    const cost = {
      systemPrompt: 1_500,
      projectContext: 900,
      builtinTools: 4_500,
      mcp: 1_200,
      mcpToolCount: 3,
    };
    useUsageStore.getState().setContextCost(SID, cost);
    useUsageStore
      .getState()
      .setTurnUsage(
        SID,
        { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, total: 3 },
        { tokens: 10_000, contextWindow: 200_000, percent: 0.05 },
      );

    const entry = useUsageStore.getState().bySession[SID];
    // The overhead estimate survives the turn, and the turn's context lands intact.
    expect(entry?.cost).toEqual(cost);
    expect(entry?.context?.tokens).toBe(10_000);

    // A later overhead push keeps the most recent turn/context.
    const next = {
      systemPrompt: 1_500,
      projectContext: 900,
      builtinTools: 4_500,
      mcp: 1_500,
      mcpToolCount: 4,
    };
    useUsageStore.getState().setContextCost(SID, next);
    const after = useUsageStore.getState().bySession[SID];
    expect(after?.cost).toEqual(next);
    expect(after?.context?.tokens).toBe(10_000);
  });
});
