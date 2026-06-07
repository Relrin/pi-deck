import { describe, expect, mock, test } from "bun:test";
import type { ToolCallEntry, ToolCallStatus } from "../../../../../src/features/chat/types";
import { EDIT_RENDERER_COLLAPSED_EDITS } from "../../../../../src/lib/ui-constants";
import { fireEvent, render, screen } from "../../../../utils";

// Stub Pierre's React components so mounting `DiffView` doesn't pull in the shared worker
// pool / Shadow DOM, which happy-dom can't host. We keep the real `@pierre/diffs` (so
// `parseDiffFromFile` still runs) and only confirm EditRenderer *delegates* to the diff
// viewer for a completed edit — the diff's actual rendering is Pierre's job.
mock.module("@pierre/diffs/react", () => ({
  FileDiff: ({ fileDiff }: { fileDiff: { name: string } }) => (
    <pre data-testid="pierre-diff">{fileDiff?.name}</pre>
  ),
  PatchDiff: ({ patch }: { patch: string }) => <pre data-testid="pierre-diff">{patch}</pre>,
  useWorkerPool: () => null,
}));

// Import AFTER mock.module so the DiffView dependency resolves the stub.
const { EditRenderer, editSummary } = await import(
  "../../../../../src/features/chat/tools/renderers/EditRenderer"
);

function editCall(
  edits: { oldText?: string; newText?: string }[],
  { path = "/x.ts", status = "running" as ToolCallStatus } = {},
): ToolCallEntry {
  return { id: "t", name: "edit", status, startedAt: 1, input: { path, edits } };
}

describe("EditRenderer", () => {
  test("renders the Pierre diff for a completed edit", () => {
    render(
      <EditRenderer
        call={editCall([{ oldText: "before", newText: "after" }], { status: "done" })}
      />,
    );
    expect(screen.getByTestId("pierre-diff")).toBeInTheDocument();
    // The raw old/new fragment fallback ("1 edit") must NOT show once we have a real diff.
    expect(screen.queryByText("1 edit")).not.toBeInTheDocument();
  });

  test("falls back to old/new fragment rows while the edit is unsettled", () => {
    render(<EditRenderer call={editCall([{ oldText: "before", newText: "after" }])} />);
    expect(screen.getByText("before")).toBeInTheDocument();
    expect(screen.getByText("after")).toBeInTheDocument();
    expect(screen.queryByTestId("pierre-diff")).not.toBeInTheDocument();
  });

  test("shows the edit count in the fallback", () => {
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
