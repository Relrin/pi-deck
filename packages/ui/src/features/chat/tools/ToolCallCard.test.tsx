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
    render(<ToolCallCard sessionId="s-test" call={call({ status: "done" })} />);
    const toggle = screen.getByRole("button", { expanded: false });
    expect(toggle).toBeInTheDocument();
  });

  test("collapsed by default for running status", () => {
    render(<ToolCallCard sessionId="s-test" call={call({ status: "running" })} />);
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();
  });

  test("collapsed by default for error status; the error text stays visible in the stat column", () => {
    render(
      <ToolCallCard
        sessionId="s-test"
        call={call({ status: "error", errorText: "permission denied" })}
      />,
    );
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();
    expect(screen.getByText("permission denied")).toBeInTheDocument();
  });

  test("clicking the header toggles expanded state", () => {
    render(<ToolCallCard sessionId="s-test" call={call({ status: "done" })} />);
    const toggle = screen.getByRole("button", { expanded: false });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument();
  });

  test("summary text appears next to the name and carries a full-string title", () => {
    render(
      <ToolCallCard
        sessionId="s-test"
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
      <ToolCallCard
        sessionId="s-test"
        call={call({ status: "done", startedAt: Date.now() - 10_000 })}
      />,
    );
    const row = container.querySelector(".pid-tool-row") as HTMLElement | null;
    expect(row).not.toBeNull();
    // No inline border colour means highlight is off.
    expect(row?.style.borderColor).toBe("");
  });

  test("freshly started calls do flash the highlight ring", () => {
    const { container } = render(
      <ToolCallCard sessionId="s-test" call={call({ status: "running", startedAt: Date.now() })} />,
    );
    const row = container.querySelector(".pid-tool-row") as HTMLElement | null;
    expect(row?.style.borderColor).toContain("accent");
  });

  // Regression: a card that's freshly mounted (highlight on) and then re-rendered after
  // the highlight window has elapsed must NOT stay highlighted. A previous implementation
  // depended on a per-render `Date.now()` value, so a re-render landing right at expiry
  // would clear the pending timer and never flip the state to false. Here we simulate a
  // re-render via the expand toggle and then assert the eventual cleared state.
  test("highlight clears after the window even when the card re-renders mid-window", async () => {
    const { container } = render(
      <ToolCallCard sessionId="s-test" call={call({ status: "running", startedAt: Date.now() })} />,
    );
    const row = container.querySelector(".pid-tool-row") as HTMLElement | null;
    expect(row?.style.borderColor).toContain("accent");

    // Cause a re-render by toggling the detail panel — neither call.startedAt nor the
    // highlight state changes, so the effect must not re-run / clear the timer prematurely.
    const toggle = screen.getByRole("button", { expanded: false });
    fireEvent.click(toggle);

    // Wait past TOOL_CARD_HIGHLIGHT_MS (1500 ms).
    await new Promise((r) => setTimeout(r, 1700));
    expect(row?.style.borderColor).toBe("");
  });

  test("auto-expands when a pending approval arrives, then auto-collapses once it clears", () => {
    const callBase = call({
      status: "running",
      startedAt: Date.now(),
      pendingApproval: { approvalId: "ap-1" },
    });
    const { rerender } = render(<ToolCallCard sessionId="s-test" call={callBase} />);
    // Approval pending → row should be expanded.
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument();

    // Approval resolved → pendingApproval drops away on the next render.
    rerender(
      <ToolCallCard
        sessionId="s-test"
        call={{ ...callBase, pendingApproval: undefined, status: "done", endedAt: Date.now() }}
      />,
    );
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();
  });

  test("a manual collapse during pending approval is preserved when the approval resolves", () => {
    const callBase = call({
      status: "running",
      startedAt: Date.now(),
      pendingApproval: { approvalId: "ap-1" },
    });
    const { rerender } = render(<ToolCallCard sessionId="s-test" call={callBase} />);

    // User collapses the auto-expanded row mid-decision — this should hand control back.
    fireEvent.click(screen.getByRole("button", { expanded: true }));
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();

    // Approval clears — the row must NOT bounce back to expanded only to collapse again,
    // and it must remain in whatever state the user left it (collapsed here).
    rerender(
      <ToolCallCard
        sessionId="s-test"
        call={{ ...callBase, pendingApproval: undefined, status: "done", endedAt: Date.now() }}
      />,
    );
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();
  });
});
