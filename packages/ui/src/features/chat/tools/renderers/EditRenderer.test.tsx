import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "../../../../../test/utils";
import { EDIT_RENDERER_COLLAPSED_EDITS } from "../../../../lib/ui-constants";
import type { ToolCallEntry } from "../../types";
import { EditRenderer, editSummary } from "./EditRenderer";

function editCall(edits: { oldText?: string; newText?: string }[], path = "/x.ts"): ToolCallEntry {
  return {
    id: "t",
    name: "edit",
    status: "done",
    startedAt: 1,
    input: { path, edits },
  };
}

describe("EditRenderer", () => {
  test("renders both old and new text rows", () => {
    render(<EditRenderer call={editCall([{ oldText: "before", newText: "after" }])} />);
    expect(screen.getByText("before")).toBeInTheDocument();
    expect(screen.getByText("after")).toBeInTheDocument();
  });

  test("shows the edit count", () => {
    render(<EditRenderer call={editCall([{ oldText: "a" }, { oldText: "b" }])} />);
    expect(screen.getByText("2 edits")).toBeInTheDocument();
  });

  test("collapses beyond the threshold with a 'show all' control", () => {
    const many = Array.from({ length: EDIT_RENDERER_COLLAPSED_EDITS + 2 }, (_, i) => ({
      oldText: `old-${i}`,
      newText: `new-${i}`,
    }));
    render(<EditRenderer call={editCall(many)} />);
    const button = screen.getByRole("button", {
      name: `Show all ${EDIT_RENDERER_COLLAPSED_EDITS + 2} edits`,
    });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    // After expansion the last edit should now be visible.
    expect(screen.getByText(`new-${EDIT_RENDERER_COLLAPSED_EDITS + 1}`)).toBeInTheDocument();
  });

  test("handles missing edits array gracefully", () => {
    render(<EditRenderer call={{ ...editCall([]), input: { path: "/x" } }} />);
    expect(screen.getByText("0 edits")).toBeInTheDocument();
  });
});

describe("editSummary", () => {
  test("returns the path as text", () => {
    expect(editSummary({ path: "/foo.ts", edits: [] })).toEqual({ text: "/foo.ts" });
  });
});
