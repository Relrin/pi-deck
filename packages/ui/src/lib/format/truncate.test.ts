import { describe, expect, test } from "bun:test";
import { truncateEnd, truncateMiddle } from "./truncate";

describe("truncateMiddle", () => {
  test("returns input as-is when under max", () => {
    expect(truncateMiddle("hello", 10)).toBe("hello");
  });

  test("returns input as-is when equal to max", () => {
    expect(truncateMiddle("hello", 5)).toBe("hello");
  });

  test("inserts ellipsis in the middle when too long", () => {
    expect(truncateMiddle("abcdefghij", 7)).toBe("abc…hij");
  });

  test("keeps both ends informative for paths", () => {
    expect(truncateMiddle("/very/long/path/to/file.ts", 14)).toBe("/very/l…ile.ts");
  });

  test("handles odd target lengths", () => {
    expect(truncateMiddle("abcdefghij", 6)).toBe("abc…ij");
  });

  test("non-string falls back to empty", () => {
    expect(truncateMiddle(undefined as unknown as string)).toBe("");
  });

  test("max <= 1 slices from the start", () => {
    expect(truncateMiddle("abcdef", 1)).toBe("a");
    expect(truncateMiddle("abcdef", 0)).toBe("");
  });
});

describe("truncateEnd", () => {
  test("returns input as-is when under max", () => {
    expect(truncateEnd("hello", 10)).toBe("hello");
  });

  test("appends ellipsis when too long", () => {
    expect(truncateEnd("abcdefghij", 6)).toBe("abcde…");
  });

  test("non-string falls back to empty", () => {
    expect(truncateEnd(undefined as unknown as string)).toBe("");
  });
});
