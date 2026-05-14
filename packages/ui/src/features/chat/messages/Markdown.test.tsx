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
});
