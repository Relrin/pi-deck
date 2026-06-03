import { describe, expect, test } from "bun:test";
import { formatMessageTime, formatMessageTimestampFull } from "./time";

// Build the timestamp from *local* date components so the assertions are timezone-independent
// (both formatters read local-time getters).
const ms = new Date(2026, 5, 4, 20, 41, 18).getTime(); // Jun 4 2026, 20:41:18 local

describe("formatMessageTime", () => {
  test("renders month + day + HH:MM (no seconds)", () => {
    expect(formatMessageTime(ms)).toBe("Jun 4, 20:41");
  });

  test("zero-pads hours and minutes", () => {
    const early = new Date(2026, 0, 9, 3, 7, 5).getTime(); // Jan 9, 03:07
    expect(formatMessageTime(early)).toBe("Jan 9, 03:07");
  });
});

describe("formatMessageTimestampFull", () => {
  test("renders month + day + year + HH:MM:SS", () => {
    expect(formatMessageTimestampFull(ms)).toBe("Jun 4, 2026, 20:41:18");
  });
});
