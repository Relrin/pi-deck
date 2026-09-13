/**
 * Pure catalog analysis shared by `i18n-check.ts` (the CLI) and `test/i18n/catalog-parity.test.ts`.
 *
 * Deliberately free of `node:` imports and of `typescript`, so the same rules that gate
 * `bun run check` also run inside `bun test` without a filesystem or a compiler. Everything here
 * operates on already-imported catalog objects.
 */

/** A catalog is a tree of nested objects whose leaves are message strings. */
export interface CatalogNode {
  [key: string]: string | CatalogNode;
}

/** Every leaf in `node`, keyed by its dotted path. */
export function leafPaths(node: CatalogNode, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [p, v] of leafPaths(value, path)) out.set(p, v);
  }
  return out;
}

/** Every *branch* path in `node` — used to tell a leaf/object shape clash from a missing key. */
export function branchPaths(node: CatalogNode, prefix = ""): Set<string> {
  const out = new Set<string>();
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    out.add(path);
    for (const p of branchPaths(value, path)) out.add(p);
  }
  return out;
}

/**
 * Plural groups are double-braced and **positional**: `{{zero|one|two|few|many|other}}`. An
 * optional `name:` prefix selects on that argument without printing it (`{{count:file|files}}`).
 *
 * The selector is only recognised when the text before the first `|` starts with an identifier
 * followed by `:` — otherwise a translated word containing a colon would be eaten as a selector.
 */
export interface PluralGroup {
  /** The argument the group selects on, when written in the `{{name:...}}` form. */
  selector?: string;
  /** The pipe-separated slots, in source order. */
  slots: string[];
  /** The whole `{{...}}` text, for error messages. */
  raw: string;
}

const PLURAL_GROUP_RE = /\{\{(.*?)\}\}/g;
const SELECTOR_RE = /^([A-Za-z_$][\w$]*):/;

export function pluralGroupsOf(message: string): PluralGroup[] {
  const out: PluralGroup[] = [];
  for (const match of message.matchAll(PLURAL_GROUP_RE)) {
    const body = match[1] ?? "";
    const pipe = body.indexOf("|");
    const head = pipe === -1 ? body : body.slice(0, pipe);
    const selector = SELECTOR_RE.exec(head)?.[1];
    const payload = selector ? body.slice(selector.length + 1) : body;
    out.push({ selector, slots: payload.split("|"), raw: match[0] });
  }
  return out;
}

/**
 * Interpolated argument names. The base catalog declares types inline (`{count:number}`) because
 * that is how the generator learns them; translation catalogs use the bare runtime form
 * (`{count}`). Both spellings yield the same name here, which is what makes param agreement
 * checkable across locales.
 *
 * Plural groups are stripped first — `{{a|b}}` is not an argument, and its inner text may contain
 * anything.
 */
export function paramsOf(message: string): Set<string> {
  const withoutPlurals = message.replace(PLURAL_GROUP_RE, "");
  const out = new Set<string>();
  for (const match of withoutPlurals.matchAll(/\{([^{}]*)\}/g)) {
    const body = match[1] ?? "";
    const name = body.split(/[:|]/, 1)[0]?.trim() ?? "";
    if (/^[A-Za-z_$][\w$]*$/.test(name)) out.add(name);
  }
  return out;
}

/** Names a translation types (`{count:number}`) where the bare runtime form `{count}` belongs. */
export function typedParamsOf(message: string): Set<string> {
  const withoutPlurals = message.replace(PLURAL_GROUP_RE, "");
  const out = new Set<string>();
  for (const match of withoutPlurals.matchAll(/\{([A-Za-z_$][\w$]*):[^{}|]+\}/g)) {
    const name = match[1];
    if (name) out.add(name);
  }
  return out;
}

/**
 * How many plural slots a locale's catalog must write.
 *
 * **Not** the number of CLDR categories `Intl.PluralRules` reports, and the difference is the
 * single easiest way to ship a blank word. typesafe-i18n destructures the slots positionally as
 * `[zero, one, two, few, many, other]` and, for any group of four or more entries, reads `many`
 * from index 4 and `other` from index 5. Russian has four CLDR categories but needs **six** slots:
 * with four, `many` and `other` are `undefined` and render as an empty string, so `5 файлов`
 * comes out as `5 `. English distinguishes `one`/`other`, and the parser special-cases a
 * two-entry group into exactly that pair.
 */
export function requiredSlotCount(locale: string): number {
  return new Intl.PluralRules(locale).resolvedOptions().pluralCategories.length > 2 ? 6 : 2;
}

/** Zero-based slot order in a six-slot group, for the `zero`/`many` consistency warning. */
export const SLOT_NAMES = ["zero", "one", "two", "few", "many", "other"] as const;

export interface Finding {
  /** Which rule produced this. */
  check: string;
  /** Dotted catalog path, or a file path for structural findings. */
  where: string;
  detail: string;
}

export interface ParityResult {
  /** In the translation but not in the base — dead weight, or a typo `deepMerge` would inject. */
  orphans: Finding[];
  /** A leaf on one side and a branch on the other. `deepMerge` would render `[object Object]`. */
  shapeMismatches: Finding[];
  /** In the base, not yet translated. Falls back per key, so this is informational. */
  missing: string[];
  translated: number;
  total: number;
}

export function compareCatalogs(base: CatalogNode, translation: CatalogNode): ParityResult {
  const baseLeaves = leafPaths(base);
  const baseBranches = branchPaths(base);
  const locLeaves = leafPaths(translation);
  const locBranches = branchPaths(translation);

  const orphans: Finding[] = [];
  const shapeMismatches: Finding[] = [];

  for (const path of locLeaves.keys()) {
    if (baseLeaves.has(path)) continue;
    if (baseBranches.has(path)) {
      shapeMismatches.push({
        check: "shape",
        where: path,
        detail: "leaf in the translation, but a branch in en",
      });
    } else {
      orphans.push({ check: "orphan", where: path, detail: "not present in en" });
    }
  }

  for (const path of locBranches) {
    if (baseLeaves.has(path)) {
      shapeMismatches.push({
        check: "shape",
        where: path,
        detail: "branch in the translation, but a leaf in en",
      });
    }
  }

  const missing = [...baseLeaves.keys()].filter((path) => !locLeaves.has(path));

  return {
    orphans,
    shapeMismatches,
    missing,
    translated: baseLeaves.size - missing.length,
    total: baseLeaves.size,
  };
}

export interface ParamResult {
  /** A `{name}` the base does not declare — the one error that ships a literal `{count}`. */
  unknown: Finding[];
  /** A `{name}` the base declares that the translation drops. Sometimes deliberate. */
  dropped: Finding[];
  /** A translation writing `{count:number}` where the runtime form `{count}` belongs. */
  typed: Finding[];
}

export function compareParams(base: CatalogNode, translation: CatalogNode): ParamResult {
  const baseLeaves = leafPaths(base);
  const unknown: Finding[] = [];
  const dropped: Finding[] = [];
  const typed: Finding[] = [];

  for (const [path, value] of leafPaths(translation)) {
    const source = baseLeaves.get(path);
    if (source === undefined) continue; // an orphan; compareCatalogs already reported it
    const expected = paramsOf(source);
    const actual = paramsOf(value);

    for (const name of actual) {
      if (!expected.has(name)) {
        unknown.push({ check: "params", where: path, detail: `{${name}} is not declared in en` });
      }
    }
    for (const name of expected) {
      if (!actual.has(name)) {
        dropped.push({ check: "params", where: path, detail: `en declares {${name}}` });
      }
    }
    for (const name of typedParamsOf(value)) {
      typed.push({ check: "params", where: path, detail: `write {${name}}, not {${name}:type}` });
    }
  }

  return { unknown, dropped, typed };
}

export interface PluralResult {
  /** Wrong number of slots for the locale. Four or five silently render an empty word. */
  badSlotCount: Finding[];
  /** The translation has a different number of `{{...}}` groups than the base. */
  groupCountMismatch: Finding[];
  /** `zero` differs from `many`. Legitimate ("нет файлов"), but usually a slip. */
  zeroDiffers: Finding[];
}

export function checkPlurals(
  base: CatalogNode,
  translation: CatalogNode,
  locale: string,
  baseLocale: string,
): PluralResult {
  const badSlotCount: Finding[] = [];
  const groupCountMismatch: Finding[] = [];
  const zeroDiffers: Finding[] = [];

  const want = requiredSlotCount(locale);
  const baseWant = requiredSlotCount(baseLocale);
  const baseLeaves = leafPaths(base);

  for (const [path, value] of baseLeaves) {
    for (const group of pluralGroupsOf(value)) {
      if (group.slots.length !== baseWant) {
        badSlotCount.push({
          check: "plurals",
          where: `${baseLocale}: ${path}`,
          detail: `${group.slots.length} slots, expected ${baseWant} — ${group.raw}`,
        });
      }
    }
  }

  for (const [path, value] of leafPaths(translation)) {
    const source = baseLeaves.get(path);
    if (source === undefined) continue;
    const groups = pluralGroupsOf(value);
    const sourceGroups = pluralGroupsOf(source);

    if (groups.length !== sourceGroups.length) {
      groupCountMismatch.push({
        check: "plurals",
        where: path,
        detail: `${groups.length} plural group(s), en has ${sourceGroups.length}`,
      });
    }

    for (const group of groups) {
      if (group.slots.length !== want) {
        badSlotCount.push({
          check: "plurals",
          where: `${locale}: ${path}`,
          detail: `${group.slots.length} slots, expected ${want} (${SLOT_NAMES.join("|")}) — ${group.raw}`,
        });
        continue;
      }
      if (want === 6 && group.slots[0] !== group.slots[4]) {
        zeroDiffers.push({
          check: "plurals",
          where: `${locale}: ${path}`,
          detail: `zero "${group.slots[0]}" differs from many "${group.slots[4]}"`,
        });
      }
    }
  }

  return { badSlotCount, groupCountMismatch, zeroDiffers };
}
