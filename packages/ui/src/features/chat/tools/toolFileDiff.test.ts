import { describe, expect, test } from "bun:test";
import type { ToolCallEntry } from "../types";
import { deriveToolFileDiff, isFileDiffTool } from "./toolFileDiff";

function call(overrides: Partial<ToolCallEntry>): ToolCallEntry {
  return { id: "t", name: "edit", status: "done", startedAt: 1, input: {}, ...overrides };
}

describe("isFileDiffTool", () => {
  test("matches edit and write only", () => {
    expect(isFileDiffTool("edit")).toBe(true);
    expect(isFileDiffTool("write")).toBe(true);
    expect(isFileDiffTool("bash")).toBe(false);
  });
});

describe("deriveToolFileDiff — edit", () => {
  test("diffs oldText → newText and counts changed lines", () => {
    const result = deriveToolFileDiff(
      call({ input: { path: "src/x.ts", edits: [{ oldText: "a\nb", newText: "a\nc" }] } }),
    );
    expect(result?.path).toBe("src/x.ts");
    expect(result?.fileDiff.name).toContain("src/x.ts");
    expect(result?.fileDiff.hunks.length).toBeGreaterThan(0);
    // Line "a" is unchanged context; only "b" → "c" counts.
    expect(result?.add).toBe(1);
    expect(result?.del).toBe(1);
  });

  test("merges multiple edits into one diff", () => {
    const result = deriveToolFileDiff(
      call({
        input: {
          path: "src/x.ts",
          edits: [
            { oldText: "one", newText: "ONE" },
            { oldText: "two", newText: "TWO" },
          ],
        },
      }),
    );
    expect(result?.add).toBe(2);
    expect(result?.del).toBe(2);
  });

  test("null while the call is still running", () => {
    expect(
      deriveToolFileDiff(
        call({
          status: "running",
          input: { path: "src/x.ts", edits: [{ oldText: "a", newText: "b" }] },
        }),
      ),
    ).toBe(null);
  });

  test("null on an errored edit (nothing was written)", () => {
    expect(
      deriveToolFileDiff(
        call({
          status: "error",
          input: { path: "src/x.ts", edits: [{ oldText: "a", newText: "b" }] },
        }),
      ),
    ).toBe(null);
  });

  test("null when the path is missing or there are no edits", () => {
    expect(deriveToolFileDiff(call({ input: { edits: [{ oldText: "a", newText: "b" }] } }))).toBe(
      null,
    );
    expect(deriveToolFileDiff(call({ input: { path: "src/x.ts", edits: [] } }))).toBe(null);
  });

  test("null when an edit is a no-op", () => {
    expect(
      deriveToolFileDiff(
        call({ input: { path: "src/x.ts", edits: [{ oldText: "a", newText: "a" }] } }),
      ),
    ).toBe(null);
  });
});

describe("deriveToolFileDiff — write", () => {
  test("renders the written content as all-additions", () => {
    const result = deriveToolFileDiff(
      call({ name: "write", input: { path: "new.ts", content: "a\nb\nc\n" } }),
    );
    expect(result?.path).toBe("new.ts");
    expect(result?.add).toBe(3);
    expect(result?.del).toBe(0);
    expect(result?.fileDiff.hunks.length).toBeGreaterThan(0);
  });

  test("null when content is empty", () => {
    expect(deriveToolFileDiff(call({ name: "write", input: { path: "x.ts", content: "" } }))).toBe(
      null,
    );
  });
});

describe("deriveToolFileDiff — other", () => {
  test("non-file tools return null", () => {
    expect(deriveToolFileDiff(call({ name: "bash", input: { command: "ls" } }))).toBe(null);
  });
});
