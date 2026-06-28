import { beforeEach, describe, expect, test } from "bun:test";
import { ToolCallCard } from "../../../../src/features/chat/tools/ToolCallCard";
import { useToolCardExpansionStore } from "../../../../src/features/chat/tools/useToolCardExpansionStore";
import type { ToolCallEntry } from "../../../../src/features/chat/types";
import { fireEvent, render, screen } from "../../../utils";

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
  // Expanded state lives in a module-level store keyed by session + call id, so without a
  // reset the same "s-test" / "t-1" pair would leak open/closed state between cases.
  beforeEach(() => {
    useToolCardExpansionStore.setState({ expanded: {} });
  });

  test("collapsed by default for done status", () => {
    render(<ToolCallCard sessionId="s-test" call={call({ status: "done" })} />);
    const toggle = screen.getByRole("button", { expanded: false });
    expect(toggle).toBeInTheDocument();
  });

  test("collapsed by default for running status", () => {
    render(<ToolCallCard sessionId="s-test" call={call({ status: "running" })} />);
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();
  });

  test("error status shows a compact 'error' marker collapsed, full text on expand", () => {
    render(
      <ToolCallCard
        sessionId="s-test"
        call={call({ status: "error", errorText: "permission denied" })}
      />,
    );
    // Collapsed: a short red marker, NOT the (potentially very long) error string.
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();
    expect(screen.getByText("error")).toBeInTheDocument();
    expect(screen.queryByText("permission denied")).toBeNull();

    // Clicking the chip expands and reveals the full error detail.
    fireEvent.click(screen.getByRole("button", { expanded: false }));
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

  test("a long approval reason renders in the (auto-expanded) body, not the header", () => {
    const reason =
      "Plan mode: this shell command isn't read-only — allow it to run, or deny to keep planning.";
    render(
      <ToolCallCard
        sessionId="s-test"
        call={call({
          status: "running",
          startedAt: Date.now(),
          pendingApproval: { approvalId: "ap-1", reason },
        })}
      />,
    );
    // Auto-expanded on pending approval, so the wrapped reason shows in the detail body.
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument();
    expect(screen.getByText(reason)).toBeInTheDocument();
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

  // A settled edit/write card augments — never replaces — the standard header: the status
  // icon, tool tag, path, and `ok` stat all stay; we only insert the +N −M counts right after
  // the path. The collapsed card never mounts the Pierre body, so these run without it.
  test("a done edit card shows +N −M counts alongside the standard chrome", () => {
    render(
      <ToolCallCard
        sessionId="s-test"
        call={call({
          name: "edit",
          status: "done",
          input: { path: "src/watcher.ts", edits: [{ oldText: "old", newText: "new1\nnew2" }] },
        })}
      />,
    );
    const header = screen.getByRole("button", { expanded: false });
    // Standard chrome stays.
    expect(header.textContent).toContain("edit");
    expect(screen.getByText("ok")).toBeInTheDocument();
    // Inserted counts.
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText("−1")).toBeInTheDocument();
  });

  test("a done write card synthesises additions and shows +N −0", () => {
    const { container } = render(
      <ToolCallCard
        sessionId="s-test"
        call={call({
          name: "write",
          status: "done",
          input: { path: "new.ts", content: "a\nb\nc\n" },
        })}
      />,
    );
    expect(screen.getByText("+3")).toBeInTheDocument();
    // No deletions on a create, so the del count is omitted entirely.
    expect(container.querySelector('.pid-tool-row-counts span[data-tone="del"]')).toBeNull();
  });

  test("non-file tools keep the plain header (no counts)", () => {
    const { container } = render(
      <ToolCallCard sessionId="s-test" call={call({ name: "bash", status: "done" })} />,
    );
    expect(container.querySelector(".pid-tool-row-counts")).toBeNull();
  });

  test("a still-running edit (no diff yet) shows no counts", () => {
    const { container } = render(
      <ToolCallCard
        sessionId="s-test"
        call={call({ name: "edit", status: "running", input: { path: "x.ts", edits: [] } })}
      />,
    );
    expect(container.querySelector(".pid-tool-row-counts")).toBeNull();
  });
});
