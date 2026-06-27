import { beforeEach, describe, expect, mock, test } from "bun:test";
import { useComposerStore } from "../../../../src/features/chat/composer/useComposerStore";
import {
  isPlanShapedMessage,
  PlanCard,
  planMarkdownHasChecklist,
} from "../../../../src/features/chat/messages/PlanCard";
import type { AssistantMessageEntry } from "../../../../src/features/chat/types";
import { usePlanCommentsStore } from "../../../../src/features/plan-panel/usePlanCommentsStore";
import { usePlanStore } from "../../../../src/features/plan-panel/usePlanStore";
import { useSessionsStore } from "../../../../src/features/sessions/useSessionsStore";
import { fireEvent, render, screen, waitFor } from "../../../utils";

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

describe("PlanCard — approval mode switch", () => {
  const SID = "session-1";

  beforeEach(() => {
    usePlanStore.setState({ bySession: {} });
    // The user is in plan mode locally (the picker shows "Plan").
    useComposerStore.setState({ bySession: { [SID]: "plan" } });
  });

  test("approving seeds the composer out of plan into the selected target mode", async () => {
    const approvePlan = mock(() => Promise.resolve({ promptId: "p1" }));
    useSessionsStore.setState({
      client: { approvePlan } as unknown as ReturnType<typeof useSessionsStore.getState>["client"],
    });
    expect(useComposerStore.getState().getMode(SID)).toBe("plan");

    render(<PlanCard message={msg("## Plan\n- [ ] step", "plan")} sessionId={SID} isLatest />);
    fireEvent.click(screen.getByRole("button", { name: /approve and execute plan/i }));

    await waitFor(() => expect(approvePlan).toHaveBeenCalledWith(SID, "accept-edits"));
    await waitFor(() => expect(useComposerStore.getState().getMode(SID)).toBe("accept-edits"));
  });
});

describe("PlanCard — request changes", () => {
  const SID = "session-1";

  beforeEach(() => {
    usePlanStore.setState({ bySession: {} });
    usePlanCommentsStore.setState({ bySession: {} });
    useComposerStore.setState({ bySession: { [SID]: "plan" } });
  });

  test("shows the pending count, submits the comments in plan mode, then clears them", async () => {
    const sendPrompt = mock(() => Promise.resolve());
    useSessionsStore.setState({
      client: {} as unknown as ReturnType<typeof useSessionsStore.getState>["client"],
      sendPrompt: sendPrompt as unknown as ReturnType<
        typeof useSessionsStore.getState
      >["sendPrompt"],
    });

    // Seed one pending comment anchored to the message id used by `msg()` ("a-1").
    usePlanCommentsStore
      .getState()
      .startDraft(SID, { messageId: "a-1", quote: "explore the repo", start: 0, end: 16 });
    usePlanCommentsStore.getState().addComment(SID, "please add tests");

    render(<PlanCard message={msg("## Plan\n- [ ] step", "plan")} sessionId={SID} isLatest />);

    const btn = screen.getByRole("button", {
      name: /send pending comments to revise the plan/i,
    });
    expect(btn.textContent).toContain("Revise");

    fireEvent.click(btn);

    await waitFor(() => expect(sendPrompt).toHaveBeenCalledTimes(1));
    const call = sendPrompt.mock.calls[0] as unknown as [string, { agentMode?: string }];
    expect(call[0]).toContain("> explore the repo");
    expect(call[0]).toContain("please add tests");
    expect(call[1]).toEqual({ agentMode: "plan" });

    await waitFor(() => expect(usePlanCommentsStore.getState().bySession[SID]).toBeUndefined());
  });

  test("no Request changes button when there are no pending comments", () => {
    useSessionsStore.setState({
      client: {} as unknown as ReturnType<typeof useSessionsStore.getState>["client"],
    });
    render(<PlanCard message={msg("## Plan\n- [ ] step", "plan")} sessionId={SID} isLatest />);
    expect(
      screen.queryByRole("button", { name: /send pending comments to revise the plan/i }),
    ).toBeNull();
  });
});
