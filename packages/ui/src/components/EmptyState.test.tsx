import { describe, expect, test } from "bun:test";
import { render, screen } from "../../test/utils";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  test("renders the title and description", () => {
    render(<EmptyState title="No project" description="Open a folder" />);
    expect(screen.getByText("No project")).toBeInTheDocument();
    expect(screen.getByText("Open a folder")).toBeInTheDocument();
  });

  test("renders the action element when provided", () => {
    render(<EmptyState title="x" action={<button type="button">Open</button>} />);
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  test("compact variant doesn't render an action when none is given", () => {
    render(<EmptyState title="x" compact />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
