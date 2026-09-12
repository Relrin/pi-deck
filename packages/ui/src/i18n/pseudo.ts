import { baseLocale, loadedLocales } from "./i18n-util";

/**
 * DEV-only pseudo-locale.
 *
 * Every string is accented, padded ~30% and wrapped in brackets. Two bugs become visible on sight
 * that no lint rule catches: text with no brackets is a string somebody forgot to move into the
 * catalog, and text that clips or wraps badly is a layout that only ever fit English. That makes
 * the phase 04-07 string sweep self-verifying.
 *
 * It is not a real locale. Adding an `en-XA` folder would put it in the generated `Locales` union,
 * ship it inside `i18n-util.sync.ts`'s static imports, and surface it in the production picker.
 * Instead we transform the already-loaded base dictionary in place and let callers force a
 * remount, so nothing about this reaches a production build.
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

function transform(node: Dictionary): Dictionary {
  const result: Dictionary = {};
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string") result[key] = pseudoize(value);
    else if (value && typeof value === "object") result[key] = transform(value as Dictionary);
    else result[key] = value;
  }
  return result;
}

/** The untouched base dictionary, kept so the toggle is reversible. */
let pristine: Dictionary | undefined;

/**
 * Swap the base locale's loaded dictionary for its pseudo-localized twin, or restore it.
 * No-ops outside a dev build.
 */
export function applyPseudoLocale(enabled: boolean): void {
  if (!import.meta.env?.DEV) return;
  const loaded = loadedLocales[baseLocale] as Dictionary | undefined;
  if (!loaded) return;

  if (enabled) {
    pristine ??= loaded;
    loadedLocales[baseLocale] = transform(pristine) as (typeof loadedLocales)[typeof baseLocale];
    return;
  }
  if (pristine) {
    loadedLocales[baseLocale] = pristine as (typeof loadedLocales)[typeof baseLocale];
  }
}
