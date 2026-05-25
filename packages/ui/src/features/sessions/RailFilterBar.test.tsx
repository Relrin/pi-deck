import { beforeEach, describe, expect, test } from "bun:test";
import userEvent from "@testing-library/user-event";
import { act, useState } from "react";
import { fireEvent, render, screen } from "../../../test/utils";
import { RailFilterBar } from "./RailFilterBar";
import { useProjectsStore } from "./useProjectsStore";
import { useSessionsFilterStore } from "./useSessionsFilterStore";

/**
 * Test harness that owns the query state for RailFilterBar so the controlled input can
 * update across keystrokes. The bare `<RailFilterBar query="" .../>` wouldn't repaint
 * after a change, so the input would revert each keypress.
 */
function StatefulHarness() {
  const [q, setQ] = useState("");
  return (
    <>
      <RailFilterBar query={q} onQueryChange={setQ} />
      <output data-testid="captured">{q}</output>
    </>
  );
}

beforeEach(() => {
  useSessionsFilterStore.getState().reset();
  useProjectsStore.setState({
    projects: [
      { id: "p-1", path: "/p/1", displayName: "Proj 1", lastOpenedAt: "2026-05-16T12:00:00Z" },
      { id: "p-2", path: "/p/2", displayName: "Proj 2", lastOpenedAt: "2026-05-15T12:00:00Z" },
    ],
    activeProjectId: "p-1",
    lastActiveSessionByProject: {},
  });
});

describe("RailFilterBar", () => {
  test("typing in the search updates the parent query", async () => {
    const user = userEvent.setup();
    render(<StatefulHarness />);
    const input = screen.getByLabelText("Filter sessions") as HTMLInputElement;
    await user.type(input, "abc");
    expect(screen.getByTestId("captured").textContent).toBe("abc");
  });

  test("clicking the trigger opens the popover; clicking 'done' closes it", () => {
    render(<RailFilterBar query="" onQueryChange={() => {}} />);
    expect(screen.queryByRole("dialog", { name: /Filter sessions/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Sort, group, and filter sessions/i }));
    expect(screen.getByRole("dialog", { name: /Filter sessions/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^done$/i }));
    expect(screen.queryByRole("dialog", { name: /Filter sessions/i })).toBeNull();
  });

  test("trigger button stays visually neutral even when filters are dirty", () => {
    render(<RailFilterBar query="" onQueryChange={() => {}} />);
    const trigger = screen.getByRole("button", { name: /Sort, group, and filter sessions/i });
    expect(trigger).not.toHaveAttribute("data-dirty");
    expect(document.querySelector(".pid-rail-filterbar-trigger-badge")).toBeNull();

    act(() => {
      useSessionsFilterStore.getState().setSince("1d");
      useSessionsFilterStore.getState().setSort("created");
    });
    // No badge, no data-dirty — the dirty signal stays inside the popover (per-section
    // dots, summary text in accent, footer "N active" label).
    expect(trigger).not.toHaveAttribute("data-dirty");
    expect(document.querySelector(".pid-rail-filterbar-trigger-badge")).toBeNull();
  });

  test("reset is disabled when every section is at its default", () => {
    render(<RailFilterBar query="" onQueryChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Sort, group, and filter sessions/i }));
    const reset = screen.getByRole("button", { name: /^reset$/i });
    expect(reset).toBeDisabled();
  });

  test("changing a section's value flips the footer label and enables reset", () => {
    render(<RailFilterBar query="" onQueryChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Sort, group, and filter sessions/i }));
    expect(screen.getByText("defaults")).toBeInTheDocument();

    act(() => {
      useSessionsFilterStore.getState().setSort("branch");
    });
    expect(screen.getByText("1 active")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^reset$/i })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
    expect(useSessionsFilterStore.getState().sort).toBe("recent");
    expect(screen.getByText("defaults")).toBeInTheDocument();
  });

  test("expanding a section reveals its options; collapsing hides them", () => {
    render(<RailFilterBar query="" onQueryChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Sort, group, and filter sessions/i }));

    const sinceSection = document.querySelector('[data-section="since"]');
    if (!sinceSection) throw new Error("since section not rendered");
    const sinceHeader = sinceSection.querySelector("button");
    if (!sinceHeader) throw new Error("since header not rendered");
    // Collapsed by default: no body rendered.
    expect(sinceSection.querySelector(".pid-sessions-filter-section-body")).toBeNull();

    fireEvent.click(sinceHeader);

    // Expanded: body renders all 5 since options as buttons inside it.
    const body = sinceSection.querySelector(".pid-sessions-filter-section-body");
    expect(body).not.toBeNull();
    expect(body?.querySelectorAll(".pid-sessions-filter-option").length).toBe(5);

    // Collapse: body removed again.
    fireEvent.click(sinceHeader);
    expect(sinceSection.querySelector(".pid-sessions-filter-section-body")).toBeNull();
  });

  test("project picker toggles individual projects and the 'All' tri-state", () => {
    render(<RailFilterBar query="" onQueryChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Sort, group, and filter sessions/i }));

    // Open Project section.
    const projectSection = [...document.querySelectorAll(".pid-sessions-filter-section")].find(
      (s) => s.getAttribute("data-section") === "project",
    );
    if (!projectSection) throw new Error("project section not rendered");
    const projectHeader = projectSection.querySelector("button");
    if (!projectHeader) throw new Error("project header not rendered");
    fireEvent.click(projectHeader);

    // The "All" row appears (we're in `kind: 'all'` so it shows 2 / 2).
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

    // Click the "Proj 1" checkbox: store flips to a subset of [p-2].
    fireEvent.click(screen.getByRole("button", { name: /Proj 1/i }));
    expect(useSessionsFilterStore.getState().project).toEqual({
      kind: "subset",
      ids: ["p-2"],
    });
  });
});
