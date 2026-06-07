import { describe, expect, test } from "bun:test";
import { formatDuration } from "../../../src/lib/format/format-duration";

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
