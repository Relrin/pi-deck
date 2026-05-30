/**
 * Compact "how long has this been running" string for tool / turn duration UI.
 *
 * - Under 10s: one decimal (`0.4s`, `1.2s`) so short tool calls still tick visibly.
 * - 10–59s: rounded integer (`12s`, `45s`) — sub-second precision stops mattering past 10s
 *   and the decimal adds visual noise.
 * - 60s+: `Xm Ys` (`1m 5s`). We don't compose hours because if pi takes an hour on a turn
 *   something is wrong; users can still read `73m 4s`.
 *
 * Negative inputs and `NaN` collapse to "0.0s" so a clock-skew or fresh mount never renders
 * a "-1.2s" stutter on the first paint before the interval first ticks.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0.0s";
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}
