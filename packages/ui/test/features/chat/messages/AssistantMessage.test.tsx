import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { AssistantMessage } from "../../../../src/features/chat/messages/AssistantMessage";
import type { AssistantMessageEntry } from "../../../../src/features/chat/types";
import { useMessagesStore } from "../../../../src/features/chat/useMessagesStore";
import { usePlanStore } from "../../../../src/features/plan-panel/usePlanStore";
import { act, fireEvent, render, screen } from "../../../utils";

const SID = "session-1";

function assistantMsg(text: string, isComplete = true): AssistantMessageEntry {
  return {
    kind: "assistant",
    id: "a-1",
    text,
    isComplete,
    toolCallIds: [],
    createdAt: 1,
  };
}

describe("AssistantMessage — context menu", () => {
  const writeText = mock(() => Promise.resolve());

  beforeEach(() => {
    writeText.mockClear();
    useMessagesStore.setState({ bySession: {} });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    // biome-ignore lint/suspicious/noExplicitAny: clipboard mock reset
    delete (navigator as any).clipboard;
  });

  test("exposes raw text as data attribute and renders three menu items on right-click", () => {
    const { container } = render(
      <AssistantMessage message={assistantMsg("**hello** world")} sessionId={SID} />,
    );
    const trigger = container.querySelector("[data-selectable-message]");
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute("data-message-raw")).toBe("**hello** world");
    act(() => {
      fireEvent.contextMenu(trigger as Element);
    });
    expect(screen.getByText("Copy text")).toBeInTheDocument();
    expect(screen.getByText("Copy as Markdown")).toBeInTheDocument();
    expect(screen.getByText("Attach selection to next prompt")).toBeInTheDocument();
  });

  test("'Copy text' copies markdown-stripped body of the assistant message", () => {
    const { container } = render(
      <AssistantMessage message={assistantMsg("**hello** `code`")} sessionId={SID} />,
    );
    act(() => {
      fireEvent.contextMenu(container.querySelector("[data-selectable-message]") as Element);
    });
    act(() => {
      fireEvent.click(screen.getByText("Copy text"));
    });
    expect(writeText).toHaveBeenCalledWith("hello code");
  });

  test("'Copy as Markdown' preserves the raw markdown body", () => {
    const { container } = render(
      <AssistantMessage message={assistantMsg("**hello** `code`")} sessionId={SID} />,
    );
    act(() => {
      fireEvent.contextMenu(container.querySelector("[data-selectable-message]") as Element);
    });
    act(() => {
      fireEvent.click(screen.getByText("Copy as Markdown"));
    });
    expect(writeText).toHaveBeenCalledWith("**hello** `code`");
  });
});

describe("AssistantMessage — nameless tool-call guard", () => {
  beforeEach(() => {
    useMessagesStore.setState({ bySession: {} });
  });

  test("skips ghost tool calls that have no name (no thin dark rectangle)", () => {
    // Reproduces what we see when pi 0.77 emits `tool_execution_start` with an empty
    // `toolName` — observed when the agent's plan-mode text contains XML-style tool
    // examples that pi tentatively parses as candidate calls. The nameless entry should
    // not paint as a row; only the well-formed tool call below it should appear.
    useMessagesStore.setState({
      bySession: {
        [SID]: {
          messages: [],
          toolCalls: {
            "ghost-1": {
              id: "ghost-1",
              name: "",
              input: undefined,
              status: "running",
              startedAt: 1,
            },
            "real-1": {
              id: "real-1",
              name: "bash",
              input: { command: "ls" },
              status: "done",
              startedAt: 2,
            },
          },
          isTurnInFlight: false,
        },
      },
    });
    const message: AssistantMessageEntry = {
      kind: "assistant",
      id: "a-1",
      text: "**Running a bash command:**",
      isComplete: true,
      toolCallIds: ["ghost-1", "real-1"],
      createdAt: 1,
    };
    const { container } = render(<AssistantMessage message={message} sessionId={SID} />);
    // Exactly one tool row renders — the ghost call is skipped before mounting the card.
    const rows = container.querySelectorAll(".pid-tool-row");
    expect(rows.length).toBe(1);
    // Sanity: the surviving row carries the bash tag.
    expect(rows[0]?.querySelector(".pid-tool-row-tag")?.textContent).toBe("bash");
  });
});

describe("AssistantMessage — plan from file (model didn't echo the checklist)", () => {
  beforeEach(() => {
    useMessagesStore.setState({ bySession: {} });
    usePlanStore.setState({ bySession: {} });
  });

  test("renders the plan from the plan file on a plan-mode turn that omits the checklist", () => {
    const message: AssistantMessageEntry = {
      kind: "assistant",
      id: "a-1",
      text: "Plan written to the file.",
      isComplete: true,
      toolCallIds: [],
      createdAt: 1,
      agentModeAtTurn: "plan",
    };
    // The message must be the latest assistant turn for the proposal fallback to apply.
    useMessagesStore.setState({
      bySession: { [SID]: { messages: [message], toolCalls: {}, isTurnInFlight: false } },
    });
    // The file holds the plan even though the message text doesn't.
    usePlanStore
      .getState()
      .applyPlanFileChanged(SID, "/p.md", "# Title\n- [ ] step one\n- [ ] step two");

    const { container } = render(<AssistantMessage message={message} sessionId={SID} />);
    expect(container.querySelector(".pid-plan-card")).not.toBeNull();
    expect(screen.getByText("step one")).toBeInTheDocument();
  });

  test("does not synthesize a plan card when the plan file has no checklist", () => {
    const message: AssistantMessageEntry = {
      kind: "assistant",
      id: "a-1",
      text: "Still thinking…",
      isComplete: true,
      toolCallIds: [],
      createdAt: 1,
      agentModeAtTurn: "plan",
    };
    useMessagesStore.setState({
      bySession: { [SID]: { messages: [message], toolCalls: {}, isTurnInFlight: false } },
    });
    usePlanStore.getState().applyPlanFileChanged(SID, "/p.md", "# Title\n\njust prose, no steps");

    const { container } = render(<AssistantMessage message={message} sessionId={SID} />);
    expect(container.querySelector(".pid-plan-card")).toBeNull();
  });
});
