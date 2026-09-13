import { describe, expect, test } from "bun:test";
import {
  formatMessageTime,
  formatMessageTimestampFull,
} from "../../../../src/features/chat/messages/time";

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

// --- Localization (phase 03) -------------------------------------------------------------------
// Everything above this line predates the Intl conversion and is asserted byte for byte. If one of
// those expectations ever needs editing, the conversion was not faithful — fix the code, not the
// test.

describe("locale awareness", () => {
  test("Russian renders its own month abbreviation, still on a 24-hour clock", () => {
    // `hourCycle: "h23"` is pinned for every locale, so only the date part changes.
    expect(formatMessageTime(ms, "ru")).toBe("4 июн., 20:41");
    expect(formatMessageTimestampFull(ms, "ru")).toBe("4 июн. 2026 г., 20:41:18");
  });

  test("an explicit `en` matches the default, so the store default is not doing hidden work", () => {
    expect(formatMessageTime(ms, "en")).toBe(formatMessageTime(ms));
    expect(formatMessageTimestampFull(ms, "en")).toBe(formatMessageTimestampFull(ms));
  });
});
