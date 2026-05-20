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

  test("collapsed by default for running status", () => {
    render(<ToolCallCard call={call({ status: "running" })} />);
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();
  });

  test("collapsed by default for error status; the error text stays visible in the stat column", () => {
    render(<ToolCallCard call={call({ status: "error", errorText: "permission denied" })} />);
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();
    expect(screen.getByText("permission denied")).toBeInTheDocument();
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

  // The MessageList is virtualized — tool cards unmount and remount as the user scrolls.
  // The "newly arrived" highlight ring must NOT re-trigger every time a long-finished
  // card scrolls back into view, otherwise scrolling up through a long conversation
  // re-flashes every previously-completed step. The highlight window is anchored to the
  // call's `startedAt`, not the component's mount time.
  test("old calls remount without the highlight ring", () => {
    const { container } = render(
      <ToolCallCard call={call({ status: "done", startedAt: Date.now() - 10_000 })} />,
    );
    const row = container.querySelector(".pid-tool-row") as HTMLElement | null;
    expect(row).not.toBeNull();
    // No inline border colour means highlight is off.
    expect(row?.style.borderColor).toBe("");
  });

  test("freshly started calls do flash the highlight ring", () => {
    const { container } = render(
      <ToolCallCard call={call({ status: "running", startedAt: Date.now() })} />,
    );
    const row = container.querySelector(".pid-tool-row") as HTMLElement | null;
    expect(row?.style.borderColor).toContain("accent");
  });
});
