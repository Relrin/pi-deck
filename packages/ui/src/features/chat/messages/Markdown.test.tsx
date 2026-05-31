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

  test("inline bold inside a GFM task list stays in a single label span", () => {
    // Regression: `.pid-plan-task-item` is display:flex, which turns inline runs into
    // separate flex items and collapses their leading/trailing whitespace. Without the
    // label wrapper in TaskListItem, `Demonstrate **edit** tool` rendered visually as
    // `Demonstrateedittool`. JSDOM doesn't actually run flex layout, so we assert the
    // structural invariant that prevents the collapse: the surrounding text and the
    // `<strong>` must live inside the same `.pid-plan-task-item-label` wrapper (one
    // flex item), not as siblings of the checkbox (three flex items).
    const { container } = render(
      <Markdown text={"- [ ] Demonstrate **edit** tool with replacements"} isComplete={true} />,
    );
    const label = container.querySelector(".pid-plan-task-item-label") as HTMLElement | null;
    expect(label).not.toBeNull();
    const strong = label?.querySelector("strong");
    expect(strong?.textContent).toBe("edit");
    // remark-gfm leaves a leading space between the checkbox input and the label text.
    expect(label?.textContent?.trim()).toBe("Demonstrate edit tool with replacements");
    // The label wrapper must be a direct child of the task <li>, not nested deeper —
    // otherwise it's not a flex item and the layout fix doesn't apply.
    expect(label?.parentElement?.classList.contains("pid-plan-task-item")).toBe(true);
  });
});
