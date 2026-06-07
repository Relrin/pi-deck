import { describe, expect, test } from "bun:test";
import { isRenderableMessage } from "../../../src/features/chat/MessageList";
import type { AssistantMessageEntry, UserMessageEntry } from "../../../src/features/chat/types";

function assistant(overrides: Partial<AssistantMessageEntry> = {}): AssistantMessageEntry {
  return {
    kind: "assistant",
    id: "a-1",
    text: "",
    isComplete: false,
    toolCallIds: [],
    createdAt: 1,
    ...overrides,
  };
}

function user(overrides: Partial<UserMessageEntry> = {}): UserMessageEntry {
  return {
    kind: "user",
    id: "u-1",
    text: "hi",
    createdAt: 1,
    ...overrides,
  };
}

describe("isRenderableMessage", () => {
  test("always renders user messages", () => {
    expect(isRenderableMessage(user())).toBe(true);
    expect(isRenderableMessage(user({ text: "" }))).toBe(true);
  });

  test("renders streaming assistants even when they're still empty", () => {
    expect(isRenderableMessage(assistant({ isComplete: false }))).toBe(true);
  });

  test("renders complete assistants that carry text", () => {
    expect(isRenderableMessage(assistant({ isComplete: true, text: "done" }))).toBe(true);
  });

  test("renders complete assistants that carry tool calls (even with no text)", () => {
    expect(
      isRenderableMessage(assistant({ isComplete: true, text: "", toolCallIds: ["t-1"] })),
    ).toBe(true);
  });

  // The bug the predicate fixes: pi's trailing no-op `message_update` followed by
  // `turn_end` would otherwise leave a dangling "MODEL · 21:59:35" tag row with no body.
  test("drops complete assistant messages that have no text and no tool calls", () => {
    expect(isRenderableMessage(assistant({ isComplete: true, text: "", toolCallIds: [] }))).toBe(
      false,
    );
  });
});
