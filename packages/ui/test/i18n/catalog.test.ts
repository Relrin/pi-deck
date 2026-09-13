import { describe, expect, test } from "bun:test";
import { deepMerge } from "../../src/i18n/deep-merge";
import en from "../../src/i18n/en";
import { loadLocale } from "../../src/i18n/i18n-util.sync";
import ru from "../../src/i18n/ru";

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
    // phased string sweep from producing merge conflicts across parallel sessions. One namespace
    // per `features/*` directory, except that `features/review/` keys under `chat.review` (it
    // renders inside the chat column) and `features/plan-panel/` keys under `plan.panel`.
    expect(Object.keys(en).sort()).toEqual([
      "chat",
      "common",
      "context",
      "diff",
      "editor",
      "files",
      "format",
      "git",
      "intro",
      "models",
      "plan",
      "sessions",
      "settings",
      "shell",
      "terminal",
      "tools",
    ]);
  });

  test("ru exposes every key en does, so a partial translation still type-checks and renders", () => {
    expect(keyPaths(ru as unknown as Node).sort()).toEqual(keyPaths(en as unknown as Node).sort());
  });

  test("an untranslated key falls back to English per key, not per catalog", () => {
    // The property that makes a half-done locale shippable, asserted against a *synthetic* partial
    // rather than against whichever real key happens to be untranslated today. Naming a live key
    // here would turn this test into a tripwire that fires the moment someone translates it —
    // which is the opposite of what it is guarding.
    const merged = deepMerge(en, { chat: {}, settings: { appearance: {} } }) as unknown as Node;
    expect(keyPaths(merged).sort()).toEqual(keyPaths(en as unknown as Node).sort());
    expect(merged.chat).toEqual((en as unknown as Node).chat);
    expect((merged.settings as Node).appearance).toEqual(
      ((en as unknown as Node).settings as Node).appearance,
    );
  });
});
