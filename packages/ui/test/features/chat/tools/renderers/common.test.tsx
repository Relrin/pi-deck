import { describe, expect, test } from "bun:test";
import {
  Chip,
  CodeBlock,
  extractTextContent,
} from "../../../../../src/features/chat/tools/renderers/common";
import { CODE_BLOCK_COLLAPSED_LINES } from "../../../../../src/lib/ui-constants";
import { fireEvent, render, screen } from "../../../../utils";

describe("Chip", () => {
  test("renders children and exposes a title for truncation", () => {
    render(<Chip title="full text">label</Chip>);
    const chip = screen.getByText("label");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveAttribute("title", "full text");
  });
});

describe("CodeBlock", () => {
  test("renders short text without a toggle", () => {
    render(<CodeBlock text="hi" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("collapses long text and offers a 'show full output' toggle", () => {
    const text = Array.from({ length: CODE_BLOCK_COLLAPSED_LINES + 5 }, (_, i) => `line ${i}`).join(
      "\n",
    );
    render(<CodeBlock text={text} />);
    const toggle = screen.getByRole("button");
    expect(toggle.textContent).toContain(`${CODE_BLOCK_COLLAPSED_LINES + 5} lines`);
  });

  test("toggle expands and collapses", () => {
    const text = Array.from({ length: 60 }, (_, i) => `line ${i}`).join("\n");
    render(<CodeBlock text={text} />);
    const toggle = screen.getByRole("button");
    fireEvent.click(toggle);
    expect(toggle.textContent).toBe("Show less");
    fireEvent.click(toggle);
    expect(toggle.textContent).toContain("Show full");
  });
});

describe("extractTextContent", () => {
  test("strings pass through", () => {
    expect(extractTextContent("hello")).toBe("hello");
  });

  test("Claude-style content arrays concatenate text blocks with newlines", () => {
    expect(
      extractTextContent({
        content: [
          { type: "text", text: "one" },
          { type: "text", text: "two" },
          { type: "image", source: "ignored" },
        ],
      }),
    ).toBe("one\ntwo");
  });

  test("non-text-array shapes return empty", () => {
    expect(extractTextContent({})).toBe("");
    expect(extractTextContent(null)).toBe("");
    expect(extractTextContent(42)).toBe("");
  });
});
