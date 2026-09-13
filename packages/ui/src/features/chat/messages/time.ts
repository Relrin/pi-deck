import type { Locale } from "@pi-deck/core";
import { currentLocale } from "../../../i18n/t";

/**
 * Message timestamps, formatted by `Intl.DateTimeFormat` rather than a hand-rolled month table.
 *
 * Two option choices are load-bearing and must not be "tidied away":
 *
 * - **`hourCycle: "h23"` is pinned deliberately** instead of letting the locale decide. An `en-US`
 *   reader would otherwise get "8:41 PM". A terminal-adjacent developer tool reasonably prefers a
 *   24-hour clock, and if a 12/24-hour preference is ever wanted it belongs in `usePreferencesStore`
 *   as its own setting — NOT as a side effect of the language picker.
 * - **No `timeZone` option.** Both formatters stay on local time. That is what makes
 *   `test/features/chat/messages/time.test.ts` timezone-independent: it builds its dates from local
 *   components (`new Date(2026, 5, 4, …)`) and nothing in the repo pins `TZ`. Pinning a zone here
 *   would break those assertions on every machine outside it.
 */
const SHORT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
};

const FULL_OPTIONS: Intl.DateTimeFormatOptions = {
  ...SHORT_OPTIONS,
  year: "numeric",
  second: "2-digit",
};

/**
 * Per-locale formatter caches. Constructing an `Intl.DateTimeFormat` is the expensive part and the
 * message list formats a timestamp for every row on every render.
 */
const shortCache = new Map<Locale, Intl.DateTimeFormat>();
const fullCache = new Map<Locale, Intl.DateTimeFormat>();

function formatter(
  cache: Map<Locale, Intl.DateTimeFormat>,
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const cached = cache.get(locale);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat(locale, options);
  cache.set(locale, created);
  return created;
}

/**
 * Inline message timestamp — "Jun 4, 20:41" in English, "4 июн., 20:41" in Russian.
 *
 * `locale` defaults to the store for tests and imperative callers. **A React component must pass
 * its own locale** (from `useI18nContext()`), or it will not re-render when the user switches
 * language.
 */
export function formatMessageTime(ms: number, locale: Locale = currentLocale()): string {
  return formatter(shortCache, locale, SHORT_OPTIONS).format(ms);
}

/** Full-precision timestamp for the hover tooltip, e.g. "Jun 4, 2026, 20:41:18". */
export function formatMessageTimestampFull(ms: number, locale: Locale = currentLocale()): string {
  return formatter(fullCache, locale, FULL_OPTIONS).format(ms);
}
