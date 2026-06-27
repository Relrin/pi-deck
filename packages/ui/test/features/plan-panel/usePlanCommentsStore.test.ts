import { beforeEach, describe, expect, test } from "bun:test";
import {
  composeCommentsMessage,
  type PlanComment,
  usePlanCommentsStore,
} from "../../../src/features/plan-panel/usePlanCommentsStore";

const SID = "s1";
const MID = "m1";

beforeEach(() => {
  usePlanCommentsStore.setState({ bySession: {} });
});

describe("usePlanCommentsStore", () => {
  test("startDraft then addComment promotes the draft into a pending comment", () => {
    const s = usePlanCommentsStore.getState();
    s.startDraft(SID, { messageId: MID, quote: "step one", start: 0, end: 8 });
    expect(usePlanCommentsStore.getState().bySession[SID]?.draft?.quote).toBe("step one");

    s.addComment(SID, "  please clarify  ");
    const after = usePlanCommentsStore.getState().bySession[SID];
    expect(after?.draft).toBeNull();
    expect(after?.comments).toHaveLength(1);
    expect(after?.comments[0]).toMatchObject({
      messageId: MID,
      quote: "step one",
      reply: "please clarify",
    });
  });

  test("addComment is a no-op without a draft or with a blank reply", () => {
    const s = usePlanCommentsStore.getState();
    s.addComment(SID, "orphan"); // no draft yet
    expect(usePlanCommentsStore.getState().bySession[SID]).toBeUndefined();

    s.startDraft(SID, { messageId: MID, quote: "q", start: 0, end: 1 });
    s.addComment(SID, "   ");
    const after = usePlanCommentsStore.getState().bySession[SID];
    expect(after?.comments).toHaveLength(0);
    expect(after?.draft).not.toBeNull();
  });

  test("cancelDraft clears the draft", () => {
    const s = usePlanCommentsStore.getState();
    s.startDraft(SID, { messageId: MID, quote: "q", start: 0, end: 1 });
    s.cancelDraft(SID);
    expect(usePlanCommentsStore.getState().bySession[SID]?.draft).toBeNull();
  });

  test("updateComment edits the reply; removeComment drops it", () => {
    const s = usePlanCommentsStore.getState();
    s.startDraft(SID, { messageId: MID, quote: "q", start: 0, end: 1 });
    s.addComment(SID, "first");
    const id = usePlanCommentsStore.getState().bySession[SID]?.comments[0]?.id ?? "";
    expect(id).not.toBe("");

    s.updateComment(SID, id, "edited");
    expect(usePlanCommentsStore.getState().bySession[SID]?.comments[0]?.reply).toBe("edited");

    s.removeComment(SID, id);
    expect(usePlanCommentsStore.getState().bySession[SID]?.comments).toHaveLength(0);
  });

  test("clearSession drops everything for the session", () => {
    const s = usePlanCommentsStore.getState();
    s.startDraft(SID, { messageId: MID, quote: "q", start: 0, end: 1 });
    s.addComment(SID, "x");
    s.clearSession(SID);
    expect(usePlanCommentsStore.getState().bySession[SID]).toBeUndefined();
  });
});

describe("composeCommentsMessage", () => {
  test("renders each comment as a blockquote + reply with a closing instruction", () => {
    const comments: PlanComment[] = [
      { id: "1", messageId: MID, quote: "line a\nline b", start: 0, end: 1, reply: "do X" },
      { id: "2", messageId: MID, quote: "second", start: 2, end: 3, reply: "do Y" },
    ];
    const out = composeCommentsMessage(comments);
    expect(out).toContain("> line a\n> line b\n\ndo X");
    expect(out).toContain("> second\n\ndo Y");
    expect(out).toContain("\n\n---\n\n");
    expect(out).toContain("keep it in plan mode");
  });
});
