import { describe, expect, test } from "bun:test";
import {
  type CatalogNode,
  checkPlurals,
  compareCatalogs,
  compareParams,
  requiredSlotCount,
} from "../../scripts/i18n-audit";
import en from "../../src/i18n/en";

/**
 * The `i18n-check` rules that are **fatal**, re-asserted as unit tests so a broken catalog fails
 * `bun test` and not only `bun run check`.
 *
 * Two deliberate shapes here:
 *
 * - The translations are imported as their **raw per-namespace modules**, never through
 *   `ru/index.ts`. That one is `deepMerge(en, …)` and has perfect parity with the base catalog by
 *   construction, so measuring against it would report every rule green forever.
 * - *Missing* keys are not asserted. Per-key fallback is what makes a partly-translated locale
 *   shippable, and a test that demanded completeness would make incremental translation
 *   impossible — the one thing the whole design exists to allow. Coverage is reported by
 *   `bun run i18n:check` instead, where it is a warning.
 */
const BASE_LOCALE = "en";
const base = en as unknown as CatalogNode;
const namespaces = Object.keys(base);

async function rawCatalog(locale: string): Promise<CatalogNode> {
  const out: CatalogNode = {};
  for (const ns of namespaces) {
    out[ns] = (await import(`../../src/i18n/${locale}/${ns}`)).default as CatalogNode;
  }
  return out;
}

const LOCALES = ["ru"];

describe("catalog parity", () => {
  for (const locale of LOCALES) {
    describe(locale, () => {
      test("has no orphan keys", async () => {
        const { orphans } = compareCatalogs(base, await rawCatalog(locale));
        expect(orphans.map((f) => f.where)).toEqual([]);
      });

      test("has no leaf/branch shape mismatches", async () => {
        // A leaf where the base has a branch (or the reverse) survives `deepMerge` and renders
        // `[object Object]` at the call site — invisible until someone opens that screen.
        const { shapeMismatches } = compareCatalogs(base, await rawCatalog(locale));
        expect(shapeMismatches.map((f) => f.where)).toEqual([]);
      });

      test("interpolates only parameters the base declares", async () => {
        // The one error class that ships a literal `{count}` to a user.
        const { unknown } = compareParams(base, await rawCatalog(locale));
        expect(unknown.map((f) => `${f.where}: ${f.detail}`)).toEqual([]);
      });

      test("writes every plural with the slot count the locale needs", async () => {
        // Positional slots: four or five entries leave `many`/`other` undefined and render an
        // empty word, so `5 файлов` comes out as `5 `. Russian needs six, English two.
        const { badSlotCount, groupCountMismatch } = checkPlurals(
          base,
          await rawCatalog(locale),
          locale,
          BASE_LOCALE,
        );
        expect(badSlotCount.map((f) => `${f.where}: ${f.detail}`)).toEqual([]);
        expect(groupCountMismatch.map((f) => `${f.where}: ${f.detail}`)).toEqual([]);
      });
    });
  }

  test("the required slot count is derived from the locale, not hardcoded", () => {
    // Guards the derivation itself: English distinguishes one/other, Russian has four CLDR
    // categories and therefore needs all six positional slots.
    expect(requiredSlotCount("en")).toBe(2);
    expect(requiredSlotCount("ru")).toBe(6);
  });
});
