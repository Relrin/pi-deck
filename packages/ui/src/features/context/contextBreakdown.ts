import type { ContextUsage } from "@pi-deck/core/protocol/events.js";

/**
 * Per-category split of the session's context window usage, surfaced by the composer's
 * `ContextUsageIndicator` ring tooltip and the right-pane Context tab. Pi only reports an
 * aggregate token count via `AgentSession.getSessionStats()`, so the breakdown is derived
 * renderer-side from the messages already in `useMessagesStore`. The numbers always sum to
 * `used`, and `free` = `contextWindow - used` so the four buckets tile the window exactly.
 *
 * Anchor for the consumer: keep this shape stable. Adding a bucket means updating the
 * segmented bar in the Context tab and the row list in the indicator together.
 */
export interface ContextBreakdown {
  used: number;
  contextWindow: number;
  messages: number;
  systemPrompt: number;
  tools: number;
  free: number;
}

const DEFAULT_CONTEXT_WINDOW = 200_000;
const SYSTEM_PROMPT_FLOOR = 1_500; // ballpark — pi's base prompt + envelopes.
const TOOLS_FLOOR = 4_500; // ballpark — pi's built-in tool definitions.

/**
 * Derive a per-category breakdown from `ContextUsage` (aggregate, from pi) and the visible
 * messages (used to estimate the messages bucket). When pi hasn't reported usage yet (`ctx`
 * is undefined) we still surface a floor estimate so the Context tab paints something useful.
 */
export function computeContextBreakdown(
  ctx: ContextUsage | undefined,
  messages: ReadonlyArray<{ text?: string }>,
): ContextBreakdown {
  const messagesTokens = estimateMessagesTokens(messages);
  const contextWindow = ctx?.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  const used =
    typeof ctx?.tokens === "number" && ctx.tokens > 0
      ? ctx.tokens
      : messagesTokens + SYSTEM_PROMPT_FLOOR + TOOLS_FLOOR;

  // Slice the aggregate by category: messages dominates; the rest is split between system
  // prompt + tools using the floor constants, with any leftover staying in "tools".
  const messagesBucket = Math.min(messagesTokens, used);
  const remainder = Math.max(0, used - messagesBucket);
  const systemPrompt = Math.min(SYSTEM_PROMPT_FLOOR, remainder);
  const tools = Math.max(0, remainder - systemPrompt);
  const free = Math.max(0, contextWindow - used);

  return {
    used,
    contextWindow,
    messages: messagesBucket,
    systemPrompt,
    tools,
    free,
  };
}

/** Display helper used by both the ring tooltip and the Context tab. */
export function formatTokens(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(2)}k`;
  return String(n);
}

function estimateMessagesTokens(messages: ReadonlyArray<{ text?: string }>): number {
  let chars = 0;
  for (const m of messages) {
    if (typeof m.text === "string") chars += m.text.length;
  }
  return Math.ceil(chars / 4);
}
