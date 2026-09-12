import { describe, expect, test } from "bun:test";
import en from "../../src/i18n/en";
import { loadLocale } from "../../src/i18n/i18n-util.sync";
import ru from "../../src/i18n/ru";
import { llFor } from "../../src/i18n/t";

loadLocale("ru");

type Node = Record<string, unknown>;

function keyPaths(node: Node, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" ? keyPaths(value as Node, path) : [path];
  });
}

describe("catalogs", () => {
  test("every namespace file is wired into the base catalog", () => {
    // The first key segment must equal the namespace filename — that convention is what keeps the
    // phased string sweep from producing merge conflicts across parallel sessions.
    expect(Object.keys(en).sort()).toEqual([
      "chat",
      "common",
      "editor",
      "format",
      "git",
      "intro",
      "plan",
      "sessions",
      "settings",
      "terminal",
    ]);
  });

  test("ru exposes every key en does, so a partial translation still type-checks and renders", () => {
    expect(keyPaths(ru as unknown as Node).sort()).toEqual(keyPaths(en as unknown as Node).sort());
  });

  test("an untranslated ru key falls back to English per key, not per catalog", () => {
    // Nothing in `settings` is translated yet, so Russian must still render the English string
    // rather than a blank or a key path. This is the property that makes a half-done locale
    // shippable, and it is `extendDictionary` that provides it.
    expect(llFor("ru").settings.appearance.language.label()).toBe(
      llFor("en").settings.appearance.language.label(),
    );
  });
});
