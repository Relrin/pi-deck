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

  test("renders attachment chips when attachments are present", () => {
    const message: UserMessageEntry = {
      kind: "user",
      id: "u-1",
      text: "what are these?",
      createdAt: 1,
      attachments: [
        { kind: "file", path: "/abs/path/demo_config.json" },
        { kind: "folder", path: "src" },
        { kind: "repo-ref", path: "packages/ui" },
      ],
    };
    const { container } = render(<UserMessage message={message} />);
    const chipRow = container.querySelector(".pid-user-attachments");
    expect(chipRow).not.toBeNull();
    const chips = chipRow?.querySelectorAll(".pid-composer-attachment") ?? [];
    expect(chips.length).toBe(3);
    expect(chips[0]?.textContent).toContain("demo_config.json");
    expect(chips[1]?.textContent).toContain("src");
    expect(chips[2]?.textContent).toContain("ui");
    // No remove buttons in history — chips are immutable once sent.
    expect(chipRow?.querySelector(".pid-composer-attachment-remove")).toBeNull();
  });

  test("omits the chip row when attachments are absent or empty", () => {
    const withoutField = render(<UserMessage message={userMsg("hi")} />);
    expect(withoutField.container.querySelector(".pid-user-attachments")).toBeNull();
    withoutField.unmount();

    const empty: UserMessageEntry = {
      kind: "user",
      id: "u-2",
      text: "hi",
      createdAt: 1,
      attachments: [],
    };
    const { container } = render(<UserMessage message={empty} />);
    expect(container.querySelector(".pid-user-attachments")).toBeNull();
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

  test("'Copy text' ignores any global selection and only copies this message", () => {
    const { container } = render(<UserMessage message={userMsg("just this")} />);
    // Simulate the user having selected unrelated text elsewhere on the page.
    const stray = document.createElement("div");
    stray.textContent = "stray selection from another message";
    document.body.appendChild(stray);
    const range = document.createRange();
    range.selectNodeContents(stray);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    act(() => {
      fireEvent.contextMenu(container.querySelector("[data-selectable-message]") as Element);
    });
    act(() => {
      fireEvent.click(screen.getByText("Copy text"));
    });
    expect(writeText).toHaveBeenCalledWith("just this");
    sel?.removeAllRanges();
    stray.remove();
  });

  test("'Copy as Markdown' ignores any global selection and only copies this message", () => {
    const { container } = render(<UserMessage message={userMsg("**only me**")} />);
    const stray = document.createElement("div");
    stray.textContent = "stray selection from another message";
    document.body.appendChild(stray);
    const range = document.createRange();
    range.selectNodeContents(stray);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    act(() => {
      fireEvent.contextMenu(container.querySelector("[data-selectable-message]") as Element);
    });
    act(() => {
      fireEvent.click(screen.getByText("Copy as Markdown"));
    });
    expect(writeText).toHaveBeenCalledWith("**only me**");
    sel?.removeAllRanges();
    stray.remove();
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
