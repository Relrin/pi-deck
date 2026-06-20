import { describe, expect, test } from "bun:test";
import type { ContextUsage } from "@pi-deck/core/protocol/events.js";
import {
  type ContextBreakdown,
  computeContextBreakdown,
} from "../../../src/features/context/contextBreakdown";

const ctx = (tokens: number, contextWindow = 200_000): ContextUsage => ({
  tokens,
  contextWindow,
  percent: tokens / contextWindow,
});

/** The four token buckets always tile `used` exactly. */
function bucketSum(b: ContextBreakdown): number {
  return b.messages + b.systemPrompt + b.tools + b.mcp;
}

describe("computeContextBreakdown — mcp bucket", () => {
  const messages = [{ text: "x".repeat(4_000) }]; // ~1,000 tokens (chars/4).

  test("defaults to 0 and keeps today's split when no MCP estimate is given", () => {
    const b = computeContextBreakdown(ctx(50_000), messages);
    expect(b.mcp).toBe(0);
    expect(b.messages).toBe(1_000);
    expect(b.systemPrompt).toBe(1_500);
    expect(b.tools).toBe(47_500);
    expect(bucketSum(b)).toBe(b.used);
  });

  test("carves the MCP estimate out of the built-in tools bucket post-turn", () => {
    const b = computeContextBreakdown(ctx(50_000), messages, 5_000);
    expect(b.mcp).toBe(5_000);
    expect(b.tools).toBe(42_500);
    expect(bucketSum(b)).toBe(50_000);
  });

  test("clamps the MCP estimate so it never exceeds the real aggregate", () => {
    const b = computeContextBreakdown(ctx(50_000), messages, 100_000);
    expect(b.mcp).toBe(47_500); // everything left after messages + system prompt
    expect(b.tools).toBe(0);
    expect(bucketSum(b)).toBe(50_000);
  });

  test("folds the MCP estimate into the pre-turn floor so the bar reflects it immediately", () => {
    const b = computeContextBreakdown(undefined, [], 3_000);
    // floor = messages(0) + system(1_500) + builtin tools(4_500) + mcp(3_000)
    expect(b.used).toBe(9_000);
    expect(b.mcp).toBe(3_000);
    expect(b.tools).toBe(4_500);
    expect(b.free).toBe(191_000);
  });
});
