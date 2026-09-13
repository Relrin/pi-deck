import type { Locale } from "@pi-deck/core";
import { currentLocale, llFor } from "../../i18n/t";

/**
 * Per-locale number formatters.
 *
 * **`useGrouping: false` is load-bearing.** Without it a long turn renders "1,234m 4s" instead of
 * "1234m 4s", diverging from the `toFixed` output this replaced. The one-decimal variant reproduces
 * `toFixed(1)` byte for byte across every threshold the tests pin.
 */
const decimalCache = new Map<Locale, Intl.NumberFormat>();
const integerCache = new Map<Locale, Intl.NumberFormat>();

function decimal(locale: Locale): Intl.NumberFormat {
  const cached = decimalCache.get(locale);
  if (cached) return cached;
  const created = new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  decimalCache.set(locale, created);
  return created;
}

function integer(locale: Locale): Intl.NumberFormat {
  const cached = integerCache.get(locale);
  if (cached) return cached;
  const created = new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: 0,
  });
  integerCache.set(locale, created);
  return created;
}

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
 * a "-1.2s" stutter on the first paint before the interval first ticks. That guard must stay
 * **first**: `Intl.NumberFormat` renders `Infinity` as "∞", so reordering it would leak "∞s".
 *
 * `locale` defaults to the store for tests and imperative callers. **A React component must pass
 * its own locale** (from `useI18nContext()`), or it will not re-render on a language switch.
 */
export function formatDuration(ms: number, locale: Locale = currentLocale()): string {
  const t = llFor(locale);
  const seconds = (value: string) => t.format.duration.seconds({ value });

  if (!Number.isFinite(ms) || ms < 0) return seconds(decimal(locale).format(0));
  if (ms < 10_000) return seconds(decimal(locale).format(ms / 1000));
  if (ms < 60_000) return seconds(integer(locale).format(Math.round(ms / 1000)));
  const int = integer(locale);
  return t.format.duration.minutesSeconds({
    minutes: int.format(Math.floor(ms / 60_000)),
    seconds: int.format(Math.round((ms % 60_000) / 1000)),
  });
}
