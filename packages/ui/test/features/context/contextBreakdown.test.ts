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

describe("computeContextBreakdown", () => {
  const messages = [{ text: "x".repeat(4_000) }]; // ~1,000 tokens (chars/4).

  test("falls back to the floor constants when the worker hasn't reported overhead", () => {
    const b = computeContextBreakdown(ctx(50_000), messages);
    expect(b.systemPrompt).toBe(1_500);
    expect(b.tools).toBe(4_500);
    expect(b.mcp).toBe(0);
    // Messages is the residual of the real aggregate — everything not accounted for as overhead.
    expect(b.messages).toBe(44_000);
    expect(bucketSum(b)).toBe(50_000);
  });

  test("uses the worker's computed overhead instead of the floors; messages is the residual", () => {
    const b = computeContextBreakdown(ctx(50_000), messages, {
      systemPrompt: 2_000,
      builtinTools: 6_000,
      mcp: 5_000,
    });
    expect(b.systemPrompt).toBe(2_000);
    expect(b.tools).toBe(6_000);
    expect(b.mcp).toBe(5_000);
    expect(b.messages).toBe(37_000);
    expect(bucketSum(b)).toBe(50_000);
  });

  test("clamps overhead to the aggregate so the buckets never exceed `used`", () => {
    const b = computeContextBreakdown(ctx(3_000), messages, {
      systemPrompt: 2_000,
      builtinTools: 6_000,
      mcp: 5_000,
    });
    expect(b.systemPrompt).toBe(2_000);
    expect(b.tools).toBe(1_000); // only 1k left after the system prompt
    expect(b.mcp).toBe(0);
    expect(b.messages).toBe(0);
    expect(bucketSum(b)).toBe(3_000);
  });

  test("pre-turn: used = overhead + a chars/4 estimate of the visible messages", () => {
    const b = computeContextBreakdown(undefined, messages, {
      systemPrompt: 2_000,
      builtinTools: 6_000,
      mcp: 3_000,
    });
    expect(b.used).toBe(12_000); // 2_000 + 6_000 + 3_000 + 1_000
    expect(b.systemPrompt).toBe(2_000);
    expect(b.tools).toBe(6_000);
    expect(b.mcp).toBe(3_000);
    expect(b.messages).toBe(1_000);
    expect(b.free).toBe(188_000);
  });
});
