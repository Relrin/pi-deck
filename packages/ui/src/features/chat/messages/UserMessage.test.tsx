import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render, screen } from "../../../../test/utils";
import type { UserMessageEntry } from "../types";
import { useDraftStore } from "../useDraftStore";
import { UserMessage } from "./UserMessage";

function userMsg(text: string): UserMessageEntry {
  return { kind: "user", id: "u-1", text, createdAt: 1 };
}

describe("UserMessage", () => {
  test("renders text preserving whitespace", () => {
    const { container } = render(<UserMessage message={userMsg("line one\n  indented")} />);
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toBe("line one\n  indented");
    expect(pre?.className).toContain("whitespace-pre-wrap");
  });

  test("exposes the raw text as a data attribute for selection capture", () => {
    const { container } = render(<UserMessage message={userMsg("hello")} />);
    const el = container.querySelector("[data-selectable-message]");
    expect(el).not.toBeNull();
    expect(el?.getAttribute("data-message-raw")).toBe("hello");
  });
});

describe("UserMessage — context menu", () => {
  const writeText = mock(() => Promise.resolve());

  beforeEach(() => {
    writeText.mockClear();
    useDraftStore.setState({ pendingInsert: undefined });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    // biome-ignore lint/suspicious/noExplicitAny: clipboard mock reset
    delete (navigator as any).clipboard;
  });

  test("right-click opens the menu with the three items", () => {
    const { container } = render(<UserMessage message={userMsg("hello world")} />);
    const trigger = container.querySelector("[data-selectable-message]");
    expect(trigger).not.toBeNull();
    act(() => {
      fireEvent.contextMenu(trigger as Element);
    });
    expect(screen.getByText("Copy text")).toBeInTheDocument();
    expect(screen.getByText("Copy as Markdown")).toBeInTheDocument();
    expect(screen.getByText("Attach selection to next prompt")).toBeInTheDocument();
  });

  test("'Copy as Markdown' writes the raw text to the clipboard", () => {
    const { container } = render(<UserMessage message={userMsg("**bold** and `code`")} />);
    act(() => {
      fireEvent.contextMenu(container.querySelector("[data-selectable-message]") as Element);
    });
    act(() => {
      fireEvent.click(screen.getByText("Copy as Markdown"));
    });
    expect(writeText).toHaveBeenCalledWith("**bold** and `code`");
  });

  test("'Copy text' strips markdown when there's no selection", () => {
    const { container } = render(<UserMessage message={userMsg("**bold** and `code`")} />);
    act(() => {
      fireEvent.contextMenu(container.querySelector("[data-selectable-message]") as Element);
    });
    act(() => {
      fireEvent.click(screen.getByText("Copy text"));
    });
    expect(writeText).toHaveBeenCalledWith("bold and code");
  });

  test("'Attach selection to next prompt' is disabled when no selection is present", () => {
    const { container } = render(<UserMessage message={userMsg("hello")} />);
    act(() => {
      fireEvent.contextMenu(container.querySelector("[data-selectable-message]") as Element);
    });
    const item = screen.getByText("Attach selection to next prompt");
    expect(item.getAttribute("data-disabled")).not.toBeNull();
    act(() => {
      fireEvent.click(item);
    });
    expect(useDraftStore.getState().pendingInsert).toBeUndefined();
  });
});
