import { describe, expect, test } from "bun:test";
import { render } from "../../../../test/utils";
import type { UserMessageEntry } from "../types";
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
