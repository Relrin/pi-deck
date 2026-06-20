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

/**
 * This session's fixed context overhead, estimated worker-side from the real system prompt + tool
 * definitions (see `ContextCost` / the `session.context.cost` event). Optional: until the worker
 * has reported it we fall back to the floor constants below.
 */
export interface ContextOverhead {
  systemPrompt?: number;
  builtinTools?: number;
  mcp?: number;
}

const DEFAULT_CONTEXT_WINDOW = 200_000;
// Fallbacks used only until the worker reports the real per-session overhead. Ballparks: pi's base
// prompt + envelopes, and its built-in tool definitions (excludes MCP).
const SYSTEM_PROMPT_FLOOR = 1_500;
const BUILTIN_TOOLS_FLOOR = 4_500;

/**
 * Derive a per-category breakdown from `ContextUsage` (aggregate, from pi), the visible messages,
 * and the worker's overhead estimate. pi only reports an aggregate `used`, so the breakdown is an
 * *attribution* of that single number — not an independent recount.
 *
 * The overhead buckets (system prompt + built-in tools + MCP tools) are fixed for the worker's
 * lifetime and known precisely, so they're laid down first; **messages is the residual** — whatever
 * of `used` is left once the overhead is accounted for. That's the honest split: `used` is
 * dominated by the conversation, and the residual captures history + tool results + attachments the
 * visible message text alone can't see. The four buckets always sum to `used`.
 *
 * Before the first turn (`ctx` undefined) there's no aggregate, so `used` is the overhead plus a
 * chars/4 estimate of the visible messages. When the worker hasn't reported overhead yet, the floor
 * constants stand in.
 */
export function computeContextBreakdown(
  ctx: ContextUsage | undefined,
  messages: ReadonlyArray<{ text?: string }>,
  overhead: ContextOverhead = {},
): ContextBreakdown {
  const contextWindow = ctx?.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  const systemFixed = Math.max(0, overhead.systemPrompt ?? SYSTEM_PROMPT_FLOOR);
  const toolsFixed = Math.max(0, overhead.builtinTools ?? BUILTIN_TOOLS_FLOOR);
  const mcpFixed = Math.max(0, overhead.mcp ?? 0);

  const messagesTokens = estimateMessagesTokens(messages);
  const used =
    typeof ctx?.tokens === "number" && ctx.tokens > 0
      ? ctx.tokens
      : systemFixed + toolsFixed + mcpFixed + messagesTokens;

  // Lay down the fixed overhead in priority order, each clamped to what's left of `used` (so a
  // small real aggregate can't push the buckets past it), then hand the remainder to messages.
  const systemPrompt = Math.min(systemFixed, used);
  let remaining = used - systemPrompt;
  const tools = Math.min(toolsFixed, remaining);
  remaining -= tools;
  const mcp = Math.min(mcpFixed, remaining);
  remaining -= mcp;
  const messagesBucket = remaining; // residual — the conversation fills whatever overhead doesn't.
  const free = Math.max(0, contextWindow - used);

  return {
    used,
    contextWindow,
    messages: messagesBucket,
    systemPrompt,
    tools,
    mcp,
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
