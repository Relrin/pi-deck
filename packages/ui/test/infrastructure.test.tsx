import { describe, expect, test } from "bun:test";
import { render, screen } from "./utils";

describe("test infrastructure", () => {
  test("happy-dom renders the document", () => {
    expect(document).toBeDefined();
    expect(document.body).toBeDefined();
  });

  test("React Testing Library renders a component", () => {
    render(<button type="button">Hello</button>);
    expect(screen.getByRole("button", { name: "Hello" })).toBeInTheDocument();
  });

  test("jest-dom matchers are registered", () => {
    render(<input type="text" defaultValue="" placeholder="search" aria-label="search" />);
    const input = screen.getByLabelText("search");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "search");
  });
});
