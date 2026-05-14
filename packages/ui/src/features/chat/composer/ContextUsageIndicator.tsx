import type { ContextUsage } from "@pi-deck/core/protocol/events.js";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import { useMemo } from "react";
import { selectMessages, useMessagesStore } from "../useMessagesStore.js";
import { selectSessionUsage, useUsageStore } from "../useUsageStore.js";

interface ContextUsageIndicatorProps {
  sessionId: string;
}

/**
 * Circular indicator showing the share of the model's context window used so far in this
 * session, with a hover breakdown by category.
 *
 * Source of truth is `useUsageStore`, fed by `EVENT_SESSION_TURN_END`. Before the first
 * turn the ring is a faint placeholder at 0%.
 *
 * The renderer derives the per-category breakdown from messages already in the store,
 * because pi's `ContextUsage` is aggregate-only. The aggregate `tokens` total wins as the
 * "used" count; system prompt + tool definitions surface as the residual so the four rows
 * always sum to `used`.
 */
export function ContextUsageIndicator({ sessionId }: ContextUsageIndicatorProps) {
  const usage = useUsageStore(selectSessionUsage(sessionId));
  const messages = useMessagesStore(selectMessages(sessionId));

  const breakdown = useMemo(
    () => computeBreakdown(usage?.context, messages),
    [usage?.context, messages],
  );

  // No turn has happened yet — show a placeholder. Once usage data lands, the ring fills.
  const hasData = usage?.context !== undefined;
  const percent =
    hasData && breakdown.contextWindow > 0
      ? Math.min(100, Math.round((breakdown.used / breakdown.contextWindow) * 100))
      : 0;

  return (
    <RadixTooltip.Root delayDuration={150}>
      <RadixTooltip.Trigger asChild>
        <button
          type="button"
          aria-label={`Context usage: ${percent}%`}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-1.5 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-panel-hover)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <Ring percent={percent} active={!!usage?.context} />
          <span className="font-mono tabular-nums">{percent}%</span>
        </button>
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side="top"
          sideOffset={8}
          className="z-50 w-64 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-panel-2)] p-3 text-xs text-[var(--color-text)] shadow-lg"
        >
          <BreakdownCard breakdown={breakdown} percent={percent} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

interface Breakdown {
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

function computeBreakdown(
  ctx: ContextUsage | undefined,
  messages: ReadonlyArray<{ kind: string; text?: string }>,
): Breakdown {
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

function estimateMessagesTokens(messages: ReadonlyArray<{ text?: string }>): number {
  let chars = 0;
  for (const m of messages) {
    if (typeof m.text === "string") chars += m.text.length;
  }
  return Math.ceil(chars / 4);
}

function Ring({ percent, active }: { percent: number; active: boolean }) {
  const radius = 6;
  const stroke = 1.75;
  const c = 2 * Math.PI * radius;
  const dash = (percent / 100) * c;
  const colour = active ? "var(--color-accent)" : "var(--color-text-subtle)";
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      aria-hidden="true"
      role="presentation"
      focusable="false"
    >
      <circle
        cx={8}
        cy={8}
        r={radius}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={stroke}
      />
      <circle
        cx={8}
        cy={8}
        r={radius}
        fill="none"
        stroke={colour}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${c - dash}`}
        strokeDashoffset={c / 4}
        strokeLinecap="round"
        transform="rotate(-90 8 8)"
        opacity={active ? 1 : 0.5}
      />
    </svg>
  );
}

function BreakdownCard({ breakdown, percent }: { breakdown: Breakdown; percent: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">Context usage</span>
        <span className="font-mono tabular-nums text-[var(--color-text-muted)]">{percent}%</span>
      </div>
      <div className="text-[var(--color-text-muted)]">
        {formatTokens(breakdown.used)} of {formatTokens(breakdown.contextWindow)} tokens used.
      </div>
      <div className="flex flex-col gap-1 border-t border-[var(--color-border)] pt-2">
        <Row label="Messages" tokens={breakdown.messages} total={breakdown.contextWindow} />
        <Row
          label="System prompt"
          tokens={breakdown.systemPrompt}
          total={breakdown.contextWindow}
        />
        <Row
          label="Skills / tool definitions"
          tokens={breakdown.tools}
          total={breakdown.contextWindow}
        />
        <Row
          label="Free space remaining"
          tokens={breakdown.free}
          total={breakdown.contextWindow}
          muted
        />
      </div>
    </div>
  );
}

function Row({
  label,
  tokens,
  total,
  muted,
}: {
  label: string;
  tokens: number;
  total: number;
  muted?: boolean;
}) {
  const pct = total > 0 ? Math.round((tokens / total) * 100) : 0;
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={muted ? "text-[var(--color-text-muted)]" : ""}>{label}</span>
      <span className="font-mono tabular-nums text-[var(--color-text-muted)]">
        {formatTokens(tokens)} · {pct}%
      </span>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(2)}k`;
  return String(n);
}
