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
  /** Built-in (non-MCP) tool / skill definitions. */
  tools: number;
  /** MCP tool definitions (the `mcp` proxy + any direct-exposed tools), estimated worker-side. */
  mcp: number;
  free: number;
}

const DEFAULT_CONTEXT_WINDOW = 200_000;
const SYSTEM_PROMPT_FLOOR = 1_500; // ballpark — pi's base prompt + envelopes.
const BUILTIN_TOOLS_FLOOR = 4_500; // ballpark — pi's built-in tool definitions (excludes MCP).

/**
 * Derive a per-category breakdown from `ContextUsage` (aggregate, from pi), the visible messages
 * (used to estimate the messages bucket), and the worker's MCP-tools estimate. When pi hasn't
 * reported usage yet (`ctx` is undefined) we still surface a floor estimate — including the MCP
 * figure when known — so the Context tab paints something useful before the first turn.
 *
 * pi only reports an aggregate `used`, so we carve the buckets out of it in priority order
 * (messages → system prompt → MCP → built-in tools) and they always sum to `used`. Post-turn the
 * aggregate already includes MCP (those tools are in the real payload), so carving is correct;
 * pre-turn we fold the MCP estimate into the floor so the bar reflects it immediately.
 */
export function computeContextBreakdown(
  ctx: ContextUsage | undefined,
  messages: ReadonlyArray<{ text?: string }>,
  mcpTokens = 0,
): ContextBreakdown {
  const messagesTokens = estimateMessagesTokens(messages);
  const contextWindow = ctx?.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  const mcp = Math.max(0, mcpTokens);
  const used =
    typeof ctx?.tokens === "number" && ctx.tokens > 0
      ? ctx.tokens
      : messagesTokens + SYSTEM_PROMPT_FLOOR + BUILTIN_TOOLS_FLOOR + mcp;

  const messagesBucket = Math.min(messagesTokens, used);
  const afterMessages = Math.max(0, used - messagesBucket);
  const systemPrompt = Math.min(SYSTEM_PROMPT_FLOOR, afterMessages);
  const afterSystem = Math.max(0, afterMessages - systemPrompt);
  // MCP claims its estimate next, clamped so it never exceeds the real aggregate; built-in tools
  // take whatever remains.
  const mcpBucket = Math.min(mcp, afterSystem);
  const tools = Math.max(0, afterSystem - mcpBucket);
  const free = Math.max(0, contextWindow - used);

  return {
    used,
    contextWindow,
    messages: messagesBucket,
    systemPrompt,
    tools,
    mcp: mcpBucket,
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
