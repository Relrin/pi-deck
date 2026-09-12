import { describe, expect, test } from "bun:test";
import { deepMerge } from "../../src/i18n/deep-merge";

describe("deepMerge", () => {
  test("merges nested objects instead of replacing them", () => {
    // The whole point: typesafe-i18n's own extendDictionary is shallow, so `{ a: {} }` would drop
    // `a.keep`. With one file per namespace that is precisely the input shape, so a shallow merge
    // would blank every namespace a locale has not finished.
    const base = { a: { keep: "en", override: "en" }, b: { keep: "en" } };
    const merged = deepMerge(base, { a: { override: "ru" }, b: {} });

    expect(merged).toEqual({ a: { keep: "en", override: "ru" }, b: { keep: "en" } });
  });

  test("leaves the base untouched", () => {
    const base = { a: { v: "en" } };
    deepMerge(base, { a: { v: "ru" } });
    expect(base.a.v).toBe("en");
  });

  test("ignores undefined overrides rather than blanking the base", () => {
    expect(deepMerge({ a: "en" }, { a: undefined })).toEqual({ a: "en" });
  });

  test("merges arbitrarily deep, which the catalogs actually are", () => {
    // e.g. settings.appearance.language.label — three levels below the namespace.
    const base = { settings: { appearance: { language: { label: "Language", desc: "en desc" } } } };
    const merged = deepMerge(base, { settings: { appearance: { language: { label: "Язык" } } } });

    expect(merged.settings.appearance.language).toEqual({ label: "Язык", desc: "en desc" });
  });
});
