import { describe, expect, test } from "bun:test";
import { applyPseudoLocale } from "../../src/i18n/pseudo";
import { llFor } from "../../src/i18n/t";

describe("pseudo-locale", () => {
  test("no-ops outside a dev build", () => {
    // `bun test` does not set import.meta.env.DEV, which is exactly the production condition:
    // the toggle must not be able to mangle the catalog in a shipped build.
    const before = llFor("en").common.cancel();
    applyPseudoLocale(true);
    expect(llFor("en").common.cancel()).toBe(before);
    applyPseudoLocale(false);
  });
});
