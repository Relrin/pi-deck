import type { Locale } from "@pi-deck/core";
import { LOCALE_META } from "../../i18n/locale-meta";
import { currentLocale, llFor } from "../../i18n/t";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * `numeric: "always"` is load-bearing. The intuitive `"auto"` renders "yesterday" instead of
 * "1d ago", which changes English output and reads oddly next to the "2d ago" one row below it.
 *
 * The *style* is per-locale data, not a constant: English needs `narrow` to read "5m ago", while
 * Russian `narrow` degrades to a bare "-5 мин" — a minus sign with no "назад". See
 * `i18n/locale-meta.ts`, whose `relativeTimeStyle` this is the first and only reader of.
 */
const relativeCache = new Map<Locale, Intl.RelativeTimeFormat>();
const dateCache = new Map<Locale, Intl.DateTimeFormat>();

function relativeFormatter(locale: Locale): Intl.RelativeTimeFormat {
  const cached = relativeCache.get(locale);
  if (cached) return cached;
  const created = new Intl.RelativeTimeFormat(locale, {
    numeric: "always",
    style: LOCALE_META[locale].relativeTimeStyle,
  });
  relativeCache.set(locale, created);
  return created;
}

function dateFormatter(locale: Locale): Intl.DateTimeFormat {
  const cached = dateCache.get(locale);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  dateCache.set(locale, created);
  return created;
}

/**
 * Coarse "how long ago" label for session rows, branch lists and notification metadata.
 *
 * `locale` defaults to the store for tests and imperative callers. **A React component must pass
 * its own locale** (from `useI18nContext()`), or it will not re-render on a language switch.
 */
export function relativeTime(
  input: string | number | Date,
  now: number = Date.now(),
  locale: Locale = currentLocale(),
): string {
  const ts = typeof input === "number" ? input : new Date(input).getTime();
  if (Number.isNaN(ts)) return "";
  const diff = now - ts;
  if (diff < 30_000) return llFor(locale).format.justNow();
  const rtf = relativeFormatter(locale);
  if (diff < HOUR) return rtf.format(-Math.floor(diff / MINUTE), "minute");
  if (diff < DAY) return rtf.format(-Math.floor(diff / HOUR), "hour");
  if (diff < WEEK) return rtf.format(-Math.floor(diff / DAY), "day");
  return dateFormatter(locale).format(ts);
}
