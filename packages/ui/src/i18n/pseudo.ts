import type { Locale } from "@pi-deck/core";
import { loadedLocales } from "./i18n-util";

/**
 * DEV-only pseudo-locale.
 *
 * Every string is accented, padded ~30% and wrapped in brackets. Two bugs become visible on sight
 * that no lint rule catches: text with no brackets is a string somebody forgot to move into the
 * catalog, and text that clips or wraps badly is a layout that only ever fit English. That makes
 * the phase 04-07 string sweep self-verifying.
 *
 * It applies to whichever locale is on screen, not just English — it is a rendering mode, not a
 * language.
 *
 * It is not a real locale. Adding an `en-XA` folder would put it in the generated `Locales` union,
 * ship it inside `i18n-util.sync.ts`'s static imports, and surface it in the production picker.
 * Instead we transform the already-loaded dictionary in place and let callers force a remount, so
 * nothing about this reaches a production build.
 */

const ACCENTS: Record<string, string> = {
  a: "á",
  e: "é",
  i: "í",
  o: "ó",
  u: "ú",
  y: "ý",
  A: "Á",
  E: "É",
  I: "Í",
  O: "Ó",
  U: "Ú",
  Y: "Ý",
};

/** Latin filler, so the padding survives a Cyrillic-capable font check too. */
const PADDING = "……………………………………………………………………………………………………………………";

/**
 * Placeholders and plural groups must survive untouched — accenting the `a` in `{path}` renames
 * the parameter and the lookup silently returns nothing. So we only transform the runs *between*
 * braces.
 */
function pseudoize(input: string): string {
  let out = "";
  let depth = 0;
  for (const ch of input) {
    if (ch === "{") depth += 1;
    if (depth > 0) {
      out += ch;
      if (ch === "}") depth -= 1;
      continue;
    }
    out += ACCENTS[ch] ?? ch;
  }
  const padTarget = Math.ceil(input.length * 0.3);
  return `[${out}${PADDING.slice(0, padTarget)}]`;
}

type Dictionary = Record<string, unknown>;

/**
 * Recursively pseudo-localize a catalog, returning a new object.
 *
 * Exported so it can be tested directly. `applyPseudoLocale` is gated on `import.meta.env.DEV`,
 * which `bun test` never sets, so the transform would otherwise be the one piece of this feature
 * no test could reach — and it is the piece that can break interpolation if it gets placeholders
 * wrong.
 */
export function pseudoizeDictionary(node: Dictionary): Dictionary {
  const result: Dictionary = {};
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string") result[key] = pseudoize(value);
    else if (value && typeof value === "object")
      result[key] = pseudoizeDictionary(value as Dictionary);
    else result[key] = value;
  }
  return result;
}

/**
 * Untouched dictionaries, per locale, kept so the toggle is reversible.
 *
 * Keyed by locale rather than held as a single value because the toggle is orthogonal to the
 * language: pseudo-localizing Russian is just as useful as pseudo-localizing English, and it is
 * the only way to see a Cyrillic layout and its bracket markers at the same time.
 */
const pristine = new Map<Locale, Dictionary>();

/**
 * Swap one locale's loaded dictionary for its pseudo-localized twin, or restore it.
 * No-ops outside a dev build, and when the locale's catalog has not been loaded yet.
 */
export function applyPseudoLocale(locale: Locale, enabled: boolean): void {
  if (!import.meta.env?.DEV) return;
  const loaded = loadedLocales[locale] as Dictionary | undefined;
  if (!loaded) return;

  if (enabled) {
    // `loaded` is already pseudo-localized if the toggle was applied to this locale before, so
    // always transform from the stored original rather than from whatever is live.
    const original = pristine.get(locale) ?? loaded;
    pristine.set(locale, original);
    loadedLocales[locale] = pseudoizeDictionary(original) as (typeof loadedLocales)[Locale];
    return;
  }
  const original = pristine.get(locale);
  if (original) loadedLocales[locale] = original as (typeof loadedLocales)[Locale];
}
