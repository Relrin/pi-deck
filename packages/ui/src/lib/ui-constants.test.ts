import { describe, expect, test } from "bun:test";
import {
  CODE_BLOCK_COLLAPSED_LINES,
  CODE_BLOCK_MAX_HEIGHT_REM,
  EDIT_RENDERER_COLLAPSED_EDITS,
  MESSAGE_LIST_STICKY_THRESHOLD_PX,
  RESPONSIVE_BREAKPOINT_PX,
  SUMMARY_TRUNCATE_MAX,
  TOAST_DISMISS_MS,
  TOOL_CARD_HIGHLIGHT_MS,
  USER_MESSAGE_DEDUP_WINDOW_MS,
} from "./ui-constants";

describe("ui-constants", () => {
  test("all numeric constants are positive", () => {
    for (const v of [
      CODE_BLOCK_COLLAPSED_LINES,
      CODE_BLOCK_MAX_HEIGHT_REM,
      EDIT_RENDERER_COLLAPSED_EDITS,
      MESSAGE_LIST_STICKY_THRESHOLD_PX,
      RESPONSIVE_BREAKPOINT_PX,
      SUMMARY_TRUNCATE_MAX,
      TOAST_DISMISS_MS,
      TOOL_CARD_HIGHLIGHT_MS,
      USER_MESSAGE_DEDUP_WINDOW_MS,
    ]) {
      expect(v).toBeGreaterThan(0);
    }
  });

  test("responsive breakpoint is sensible (~tablet)", () => {
    expect(RESPONSIVE_BREAKPOINT_PX).toBeGreaterThan(500);
    expect(RESPONSIVE_BREAKPOINT_PX).toBeLessThan(1400);
  });
});
