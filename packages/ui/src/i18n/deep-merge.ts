type Dictionary = { [key: string]: unknown };

function isPlainObject(value: unknown): value is Dictionary {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recursively merge a partial catalog over a complete one, returning a new object.
 *
 * This exists because typesafe-i18n's own `extendDictionary` is **shallow** — it calls
 * `just-extend` without the deep flag, so `{ settings: {} }` replaces the entire `settings`
 * namespace rather than merging into it. With one file per namespace that is exactly the shape we
 * pass, so using it would blank out every namespace a locale has not finished translating.
 *
 * The behaviour we need instead is per-key fallback: an untranslated key renders its English
 * string, so a locale is useful long before it is complete.
 */
export function deepMerge<T>(base: T, partial: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(partial)) return base;

  const result: Dictionary = { ...base };
  for (const [key, value] of Object.entries(partial)) {
    if (value === undefined) continue;
    const existing = result[key];
    result[key] =
      isPlainObject(existing) && isPlainObject(value) ? deepMerge(existing, value) : value;
  }
  return result as T;
}

/**
 * A partial view of the catalog, for typing an in-progress translation. Every key is optional at
 * every depth, but a key that *is* present must exist in the base catalog and carry the same
 * placeholders — so a typo or a dropped `{param}` is a compile error rather than a blank string at
 * runtime.
 */
export type DeepPartial<T> = T extends string ? T : { [K in keyof T]?: DeepPartial<T[K]> };
