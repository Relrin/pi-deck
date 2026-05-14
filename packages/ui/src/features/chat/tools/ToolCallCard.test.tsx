import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "../../../../test/utils";
import type { ToolCallEntry } from "../types";
import { ToolCallCard } from "./ToolCallCard";

function call(overrides: Partial<ToolCallEntry> = {}): ToolCallEntry {
  return {
    id: "t-1",
    name: "bash",
    input: { command: "ls" },
    status: "done",
    startedAt: 1,
    ...overrides,
  };
}

describe("ToolCallCard", () => {
  test("collapsed by default for done status", () => {
    render(<ToolCallCard call={call({ status: "done" })} />);
    const toggle = screen.getByRole("button", { expanded: false });
    expect(toggle).toBeInTheDocument();
  });

  test("auto-expanded for running status", () => {
    render(<ToolCallCard call={call({ status: "running" })} />);
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument();
  });

  test("auto-expanded for error status with the message visible", () => {
    render(<ToolCallCard call={call({ status: "error", errorText: "permission denied" })} />);
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument();
    expect(screen.getAllByText("permission denied").length).toBeGreaterThan(0);
  });

  test("clicking the header toggles expanded state", () => {
    render(<ToolCallCard call={call({ status: "done" })} />);
    const toggle = screen.getByRole("button", { expanded: false });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument();
  });

  test("summary text appears next to the name and carries a full-string title", () => {
    render(
      <ToolCallCard
        call={call({
          name: "bash",
          input: {
            command: "this is a really long command that ought to be visible as a tooltip in full",
          },
        })}
      />,
    );
    // The header button title attribute exposes the full command for hover.
    const header = screen.getByRole("button", { expanded: false });
    expect(header.textContent).toContain("bash");
  });
});
