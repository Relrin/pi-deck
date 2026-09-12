import { describe, expect, test } from "bun:test";
import en from "../../src/i18n/en";
import { applyPseudoLocale, pseudoizeDictionary } from "../../src/i18n/pseudo";
import { llFor } from "../../src/i18n/t";

describe("applyPseudoLocale", () => {
  test("no-ops outside a dev build", () => {
    // `bun test` does not set import.meta.env.DEV, which is exactly the production condition:
    // the toggle must not be able to mangle the catalog in a shipped build.
    const before = llFor("en").common.cancel();
    applyPseudoLocale("en", true);
    expect(llFor("en").common.cancel()).toBe(before);
    applyPseudoLocale("en", false);
  });

  test("is per-locale, so it never reaches a locale the user did not toggle", () => {
    const ruBefore = llFor("ru").common.cancel();
    applyPseudoLocale("en", true);
    expect(llFor("ru").common.cancel()).toBe(ruBefore);
    applyPseudoLocale("en", false);
  });
});

describe("pseudoizeDictionary", () => {
  test("brackets and accents every string", () => {
    const out = pseudoizeDictionary({ a: "Cancel" }) as { a: string };
    expect(out.a.startsWith("[")).toBe(true);
    expect(out.a.endsWith("]")).toBe(true);
    expect(out.a).toContain("Cáncél");
  });

  test("pads so a layout that only ever fit English shows it", () => {
    const source = "Language";
    const out = pseudoizeDictionary({ a: source }) as { a: string };
    expect(out.a.length).toBeGreaterThan(source.length * 1.2);
  });

  test("leaves interpolation placeholders byte-identical", () => {
    // This is the whole reason the transform is character-by-character rather than a regex:
    // accenting the `a` in `{tool}` renames the parameter and the interpolation silently yields
    // nothing at runtime.
    const out = pseudoizeDictionary({
      a: "Run MCP tool {tool}? It cannot be checked.",
    }) as { a: string };
    expect(out.a).toContain("{tool}");
    expect(out.a).not.toContain("{tóól}");
  });

  test("leaves a typed placeholder and a plural group alone", () => {
    const out = pseudoizeDictionary({
      a: "{count:number} {{zero|one|few}}",
    }) as { a: string };
    expect(out.a).toContain("{count:number}");
    expect(out.a).toContain("{{zero|one|few}}");
  });

  test("recurses through the real catalog without dropping or adding keys", () => {
    const keyPaths = (node: Record<string, unknown>, prefix = ""): string[] =>
      Object.entries(node).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return value && typeof value === "object"
          ? keyPaths(value as Record<string, unknown>, path)
          : [path];
      });

    const source = en as unknown as Record<string, unknown>;
    expect(keyPaths(pseudoizeDictionary(source)).sort()).toEqual(keyPaths(source).sort());
  });

  test("every string in the real catalog comes back bracketed", () => {
    // The inverse of what the pseudo-locale is for: if something in the catalog renders
    // unbracketed on screen, it is a string that never went through here.
    const collect = (node: Record<string, unknown>): string[] =>
      Object.values(node).flatMap((value) =>
        typeof value === "string"
          ? [value]
          : value && typeof value === "object"
            ? collect(value as Record<string, unknown>)
            : [],
      );

    const out = collect(pseudoizeDictionary(en as unknown as Record<string, unknown>));
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((s) => s.startsWith("[") && s.endsWith("]"))).toBe(true);
  });
});
