import { describe, expect, test } from "bun:test";
import { loadLocale } from "../../../src/i18n/i18n-util.sync";
import { formatDuration } from "../../../src/lib/format/format-duration";

// `test/setup.ts` sync-loads only `en`; the Russian cases below need its catalog too. This is
// the established pattern (see `test/i18n/catalog.test.ts`) — never `mock.module` the i18n modules.
loadLocale("ru");

describe("formatDuration", () => {
  test("sub-1s renders with one decimal", () => {
    expect(formatDuration(0)).toBe("0.0s");
    expect(formatDuration(450)).toBe("0.5s");
    expect(formatDuration(999)).toBe("1.0s");
  });

  test("1s up to but not including 10s keeps one decimal", () => {
    expect(formatDuration(1200)).toBe("1.2s");
    expect(formatDuration(9500)).toBe("9.5s");
    // Boundary at 10s flips to integer.
    expect(formatDuration(9999)).toBe("10.0s");
    expect(formatDuration(10_000)).toBe("10s");
  });

  test("10s up to 60s uses integer seconds", () => {
    expect(formatDuration(12_000)).toBe("12s");
    expect(formatDuration(45_400)).toBe("45s");
    expect(formatDuration(59_999)).toBe("60s");
  });

  test("60s and above use minutes + seconds", () => {
    expect(formatDuration(60_000)).toBe("1m 0s");
    expect(formatDuration(65_000)).toBe("1m 5s");
    expect(formatDuration(3_725_000)).toBe("62m 5s");
  });

  test("invalid input collapses to 0.0s", () => {
    expect(formatDuration(Number.NaN)).toBe("0.0s");
    expect(formatDuration(-100)).toBe("0.0s");
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("0.0s");
  });
});

// --- Localization (phase 03) -------------------------------------------------------------------
// Everything above this line predates the Intl conversion and is asserted byte for byte.

describe("formatDuration — locale awareness", () => {
  test("four-digit minutes are not digit-grouped", () => {
    // The `useGrouping: false` regression guard. With grouping on this renders "1,234m 5s", which
    // diverges from the `toFixed` output this replaced and looks like a decimal to some readers.
    expect(formatDuration(74_045_000)).toBe("1234m 5s");
    expect(formatDuration(74_045_000, "ru")).toBe("1234м 5с");
  });

  test("Russian uses a comma decimal separator and the same compact units as English", () => {
    expect(formatDuration(1200, "ru")).toBe("1,2с");
    expect(formatDuration(0, "ru")).toBe("0,0с");
    expect(formatDuration(12_000, "ru")).toBe("12с");
    expect(formatDuration(65_000, "ru")).toBe("1м 5с");
  });

  test("the non-finite guard runs before any formatter, in every locale", () => {
    // `Intl.NumberFormat` renders Infinity as "∞". Reordering the guard would leak "∞с".
    expect(formatDuration(Number.POSITIVE_INFINITY, "ru")).toBe("0,0с");
    expect(formatDuration(Number.NaN, "ru")).toBe("0,0с");
  });

  test("an explicit `en` matches the default", () => {
    expect(formatDuration(1200, "en")).toBe(formatDuration(1200));
  });
});
