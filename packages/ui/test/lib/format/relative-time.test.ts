import { describe, expect, test } from "bun:test";
import { loadLocale } from "../../../src/i18n/i18n-util.sync";
import { relativeTime } from "../../../src/lib/format/relative-time";

// `test/setup.ts` sync-loads only `en`; the Russian cases below need its catalog too. This is
// the established pattern (see `test/i18n/catalog.test.ts`) — never `mock.module` the i18n modules.
loadLocale("ru");

const NOW = 1_700_000_000_000;

describe("relativeTime", () => {
  test("under 30s reads as 'just now'", () => {
    expect(relativeTime(NOW - 5_000, NOW)).toBe("just now");
    expect(relativeTime(NOW - 29_000, NOW)).toBe("just now");
  });

  test("minute-scale formats as Xm ago", () => {
    expect(relativeTime(NOW - 2 * 60 * 1000, NOW)).toBe("2m ago");
    expect(relativeTime(NOW - 59 * 60 * 1000, NOW)).toBe("59m ago");
  });

  test("hour-scale formats as Xh ago", () => {
    expect(relativeTime(NOW - 3 * 3600 * 1000, NOW)).toBe("3h ago");
    expect(relativeTime(NOW - 23 * 3600 * 1000, NOW)).toBe("23h ago");
  });

  test("day-scale formats as Xd ago", () => {
    expect(relativeTime(NOW - 2 * 86_400 * 1000, NOW)).toBe("2d ago");
    expect(relativeTime(NOW - 6 * 86_400 * 1000, NOW)).toBe("6d ago");
  });

  test("beyond a week falls back to a locale date string", () => {
    const value = relativeTime(NOW - 8 * 86_400 * 1000, NOW);
    expect(value).not.toBe("just now");
    expect(value).not.toMatch(/ago/);
    expect(value.length).toBeGreaterThan(0);
  });

  test("accepts ISO strings and Date objects", () => {
    const iso = new Date(NOW - 60_000).toISOString();
    expect(relativeTime(iso, NOW)).toBe("1m ago");
    expect(relativeTime(new Date(NOW - 60_000), NOW)).toBe("1m ago");
  });

  test("invalid input returns empty string", () => {
    expect(relativeTime("not a date", NOW)).toBe("");
  });
});

// --- Localization (phase 03) -------------------------------------------------------------------
// Everything above this line predates the Intl conversion and is asserted byte for byte.

describe("relativeTime — locale awareness", () => {
  test("Russian reads '5 мин. назад', not the bare '-5 мин' that `narrow` would give", () => {
    // This is the regression guard for `LOCALE_META.ru.relativeTimeStyle === "short"`. Switching it
    // back to `narrow` (which is what English needs) makes Russian render a lone minus sign with no
    // "назад" at all, which reads as a negative number rather than a time.
    const value = relativeTime(NOW - 5 * 60 * 1000, NOW, "ru");
    expect(value).toContain("назад");
    expect(value.startsWith("-")).toBe(false);
    expect(value).not.toContain("ago");
  });

  test("'just now' comes from the catalog, not a hardcoded string", () => {
    expect(relativeTime(NOW - 5_000, NOW, "ru")).toBe("только что");
  });

  test("numeric:'always' keeps day-scale numeric in every locale", () => {
    // `numeric: "auto"` would render "yesterday" / "вчера" here, which changes English output and
    // reads oddly directly above a "2d ago" row.
    expect(relativeTime(NOW - 86_400 * 1000, NOW, "en")).toBe("1d ago");
    expect(relativeTime(NOW - 86_400 * 1000, NOW, "ru")).not.toContain("вчера");
  });

  test("an explicit `en` matches the default", () => {
    expect(relativeTime(NOW - 2 * 60 * 1000, NOW, "en")).toBe(
      relativeTime(NOW - 2 * 60 * 1000, NOW),
    );
  });
});
