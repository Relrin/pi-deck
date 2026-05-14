import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render, screen } from "../../../../test/utils";
import type { AssistantMessageEntry } from "../types";
import { useMessagesStore } from "../useMessagesStore";
import { AssistantMessage } from "./AssistantMessage";

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
