import { describe, expect, test } from "bun:test";
import { render, screen } from "../../../../../test/utils";
import type { ToolCallEntry } from "../../types";
import { BashRenderer, bashSummary } from "./BashRenderer";

function bashCall(overrides: Partial<ToolCallEntry> = {}): ToolCallEntry {
  return {
    id: "t",
    name: "bash",
    status: "done",
    startedAt: 1,
    input: { command: "echo hi" },
    ...overrides,
  };
}

describe("BashRenderer", () => {
  test("renders the command with a $ prefix", () => {
    render(<BashRenderer call={bashCall()} />);
    expect(screen.getByText("$")).toBeInTheDocument();
    expect(screen.getByText("echo hi")).toBeInTheDocument();
  });

  test("renders multi-line output preserving newlines", () => {
    const call = bashCall({
      result: { content: [{ type: "text", text: "first line\nsecond line" }] },
    });
    render(<BashRenderer call={call} />);
    // The pre element preserves whitespace; check the raw text content.
    expect(screen.getByLabelText("Bash output").textContent).toContain("first line");
    expect(screen.getByLabelText("Bash output").textContent).toContain("second line");
  });

  test("uses partialResult when result is not yet present (live tail)", () => {
    const call = bashCall({
      status: "running",
      result: undefined,
      partialResult: { content: [{ type: "text", text: "tailing…" }] },
    });
    render(<BashRenderer call={call} />);
    expect(screen.getByLabelText("Bash output").textContent).toContain("tailing");
  });
});

describe("bashSummary", () => {
  test("returns the full command as title and a truncated text", () => {
    const long = `echo ${"x".repeat(200)}`;
    const out = bashSummary({ command: long });
    expect(out.title).toBe(long);
    expect(out.text?.endsWith("…")).toBe(true);
  });

  test("empty input returns empty summary", () => {
    expect(bashSummary({})).toEqual({});
    expect(bashSummary(null)).toEqual({});
  });
});
