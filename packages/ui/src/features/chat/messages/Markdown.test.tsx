import { describe, expect, test } from "bun:test";
import { render, screen } from "../../../../test/utils";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  test("renders bold via **", () => {
    render(<Markdown text="this is **bold** text" isComplete={true} />);
    const strong = screen.getByText("bold");
    expect(strong.tagName).toBe("STRONG");
  });

  test("renders bullet lists", () => {
    render(<Markdown text={"- a\n- b\n- c"} isComplete={true} />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBe(3);
  });

  test("renders GFM tables", () => {
    render(<Markdown text={"| h1 | h2 |\n| --- | --- |\n| a | b |"} isComplete={true} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("h1")).toBeInTheDocument();
  });

  test("inline code uses an inline element", () => {
    render(<Markdown text="this is `code` inline" isComplete={true} />);
    const code = screen.getByText("code");
    expect(code.tagName).toBe("CODE");
  });

  test("fenced code renders as a pre block while streaming (no Shiki)", () => {
    render(<Markdown text={"```bash\necho hi\n```"} isComplete={false} />);
    // While not-complete, our CodeBlock renders the plain <pre>.
    const pre = screen.getByText("echo hi", { selector: "pre code" });
    expect(pre).toBeInTheDocument();
  });

  test("empty fenced code blocks render nothing (no literal 'undefined')", () => {
    // Reproduces what we see when the agent streams an opening fence, then emits a tool
    // call that splits the assistant text segment, then closes the fence. Without the
    // guard, `String(undefined)` would leak the literal string "undefined" into the UI.
    const { container } = render(<Markdown text={"```bash\n```"} isComplete={true} />);
    expect(container.textContent).not.toContain("undefined");
    expect(container.querySelector("pre")).toBeNull();
  });

  test("unclosed fence followed by EOF renders nothing", () => {
    // Agent emits an opening fence then immediately fires a tool call, leaving the text
    // segment dangling without a closing fence. Remark closes the block at EOF — empty
    // body — which would otherwise paint a stray dark rectangle next to the tool card.
    const { container } = render(
      <Markdown text={"**3. Editing a file:**\n```xml\n"} isComplete={true} />,
    );
    expect(container.textContent).not.toContain("undefined");
    expect(container.querySelector("pre")).toBeNull();
    expect(container.querySelector("code.language-xml")).toBeNull();
  });

  test("fence with only whitespace body also renders nothing", () => {
    // Same shape but the agent emitted a literal newline inside the fence body before
    // the tool call interrupted. `extractText().replace(/\n$/, "")` should collapse it
    // to "" and the suppression should still kick in.
    const { container } = render(<Markdown text={"```xml\n   \n```"} isComplete={true} />);
    expect(container.querySelector("pre")).toBeNull();
  });
});
