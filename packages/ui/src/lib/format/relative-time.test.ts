import { describe, expect, test } from "bun:test";
import { relativeTime } from "./relative-time";

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
