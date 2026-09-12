import type { FormattersInitializer } from "typesafe-i18n";
import type { Formatters, Locales } from "./i18n-types";

/**
 * Locale-aware value formatters, referenced from catalog strings with the pipe syntax
 * (`{date|weekday}`). Intentionally empty for now — the `Intl`-backed date, number, duration and
 * relative-time formatters land in localization phase 03, which is when the hand-rolled helpers in
 * `lib/format/` and `features/chat/messages/time.ts` get converted.
 *
 * Unlike its siblings in this folder this file is NOT regenerated: typesafe-i18n scaffolds it once
 * and then leaves it alone, so it is ours to edit.
 */
export const initFormatters: FormattersInitializer<Locales, Formatters> = (_locale: Locales) => {
  const formatters: Formatters = {};

  return formatters;
};
