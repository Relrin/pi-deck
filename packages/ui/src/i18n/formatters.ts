import type { FormattersInitializer } from "typesafe-i18n";
import type { Formatters, Locales } from "./i18n-types";

/**
 * Locale-aware value formatters, referenced from catalog strings with the pipe syntax
 * (`{date|weekday}`). Deliberately still empty.
 *
 * Phase 03 put the `Intl` work in `lib/format/` and `features/chat/messages/time.ts` instead, as
 * explicit per-locale `Intl.DateTimeFormat` / `RelativeTimeFormat` / `NumberFormat` caches. Those
 * helpers compute a value and interpolate it as an already-formatted string, which keeps the
 * option choices (`hourCycle`, `numeric`, `useGrouping`) visible and unit-testable next to the
 * code that depends on them, rather than hidden behind a pipe in a catalog entry. A formatter
 * here would also mean every catalog edit had to stay in step with a second generated type.
 *
 * Add one only if a catalog string genuinely needs to format a raw value it was handed. If you do,
 * remember to re-run `bun run i18n:generate` so `Formatters` in `i18n-types.ts` picks it up.
 *
 * Unlike its siblings in this folder this file is NOT regenerated: typesafe-i18n scaffolds it once
 * and then leaves it alone, so it is ours to edit.
 */
export const initFormatters: FormattersInitializer<Locales, Formatters> = (_locale: Locales) => {
  const formatters: Formatters = {};

  return formatters;
};
