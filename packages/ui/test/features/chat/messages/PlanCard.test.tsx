import { describe, expect, test } from "bun:test";
import {
  isPlanShapedMessage,
  planMarkdownHasChecklist,
} from "../../../../src/features/chat/messages/PlanCard";
import type { AssistantMessageEntry } from "../../../../src/features/chat/types";

function msg(text: string, mode?: AssistantMessageEntry["agentModeAtTurn"]): AssistantMessageEntry {
  return {
    kind: "assistant",
    id: "a-1",
    text,
    isComplete: true,
    toolCallIds: [],
    createdAt: 0,
    ...(mode ? { agentModeAtTurn: mode } : {}),
  };
}

describe("isPlanShapedMessage", () => {
  test("true when the bubble was stamped in plan mode AND the body has a `- [ ]` line", () => {
    expect(isPlanShapedMessage(msg("## Plan\n- [ ] step 1\n- [ ] step 2", "plan"), undefined)).toBe(
      true,
    );
  });

  test("true when only the current session mode is plan and the body has a checkbox", () => {
    // Restored-session fallback: pi's sessionFile doesn't carry per-turn mode metadata, so
    // the stamp is undefined. The session's persisted mode is the source of truth.
    expect(isPlanShapedMessage(msg("- [x] step", undefined), "plan")).toBe(true);
  });

  test("false for plan-mode bubbles that contain only a clarifying question (no checkbox)", () => {
    // The plan-mode system prompt allows the agent to ask focused clarifying questions and
    // stop. Those messages should fall through to the default Markdown renderer — no plan
    // card, no Approve footer.
    expect(isPlanShapedMessage(msg("Which build system do you use?", "plan"), undefined)).toBe(
      false,
    );
  });

  test("false when the body has a checkbox but the session is not in plan mode", () => {
    // Don't false-positive on regular tasks that happen to use checkbox markdown.
    expect(isPlanShapedMessage(msg("- [ ] todo from regular reply", "ask"), "ask")).toBe(false);
  });

  test("supports `*` bullet variant for GFM task items", () => {
    expect(isPlanShapedMessage(msg("* [ ] step", "plan"), undefined)).toBe(true);
  });
});

describe("planMarkdownHasChecklist", () => {
  test("true when the markdown has a GFM task item", () => {
    expect(planMarkdownHasChecklist("# Title\n- [ ] step")).toBe(true);
    expect(planMarkdownHasChecklist("* [x] done")).toBe(true);
  });

  test("false for empty / nullish / checklist-free markdown", () => {
    expect(planMarkdownHasChecklist("just prose")).toBe(false);
    expect(planMarkdownHasChecklist("")).toBe(false);
    expect(planMarkdownHasChecklist(null)).toBe(false);
    expect(planMarkdownHasChecklist(undefined)).toBe(false);
  });
});
