import { describe, expect, test } from "bun:test";
import { render, screen } from "../../../../../test/utils";
import type { ToolCallEntry } from "../../types";
import { DefaultRenderer } from "./DefaultRenderer";
import { FindRenderer, findSummary } from "./FindRenderer";
import { GrepRenderer, grepSummary } from "./GrepRenderer";
import { LsRenderer, lsSummary } from "./LsRenderer";
import { ReadRenderer, readSummary } from "./ReadRenderer";
import { WriteRenderer, writeSummary } from "./WriteRenderer";

function call(name: string, input: unknown, result?: unknown): ToolCallEntry {
  return { id: "t", name, status: "done", startedAt: 1, input, result };
}

describe("ReadRenderer", () => {
  test("renders path chip and file body", () => {
    render(
      <ReadRenderer
        call={call("read", { path: "/a.ts" }, { content: [{ type: "text", text: "file body" }] })}
      />,
    );
    expect(screen.getByText("/a.ts")).toBeInTheDocument();
    expect(screen.getByLabelText("File contents").textContent).toContain("file body");
  });

  test("summary truncates long paths in the middle and exposes the full path as title", () => {
    const out = readSummary({ path: `/a/b/c/${"x".repeat(200)}/file.ts` });
    expect(out.title?.length).toBeGreaterThan(out.text?.length ?? 0);
    expect(out.text).toContain("…");
  });
});

describe("WriteRenderer", () => {
  test("renders path chip and content", () => {
    render(<WriteRenderer call={call("write", { path: "/a.ts", content: "new file body" })} />);
    expect(screen.getByText("/a.ts")).toBeInTheDocument();
    expect(screen.getByLabelText("File contents to write").textContent).toContain("new file body");
  });

  test("writeSummary returns path as title + truncated text", () => {
    const out = writeSummary({ path: "/short.ts" });
    expect(out.title).toBe("/short.ts");
  });
});

describe("GrepRenderer", () => {
  test("renders pattern and modifiers", () => {
    render(
      <GrepRenderer
        call={call(
          "grep",
          { pattern: "TODO", path: "src", glob: "*.ts", ignoreCase: true },
          { content: [{ type: "text", text: "src/a.ts:1:TODO\n" }] },
        )}
      />,
    );
    expect(screen.getByText("TODO")).toBeInTheDocument();
    expect(screen.getByText("in src")).toBeInTheDocument();
    expect(screen.getByText("glob *.ts")).toBeInTheDocument();
    expect(screen.getByText("case-insensitive")).toBeInTheDocument();
  });

  test("grepSummary wraps the pattern in quotes", () => {
    expect(grepSummary({ pattern: "hello" }).text).toBe('"hello"');
  });
});

describe("FindRenderer", () => {
  test("renders pattern + path scope", () => {
    render(
      <FindRenderer call={call("find", { pattern: "*.ts", path: "src" }, "src/a.ts\nsrc/b.ts")} />,
    );
    expect(screen.getByText("*.ts")).toBeInTheDocument();
    expect(screen.getByText("in src")).toBeInTheDocument();
  });

  test("findSummary returns the pattern", () => {
    expect(findSummary({ pattern: "foo" }).text).toBe("foo");
  });
});

describe("LsRenderer", () => {
  test("renders the listed path", () => {
    render(<LsRenderer call={call("ls", { path: "packages/ui" }, "src/\ntest/\n")} />);
    expect(screen.getByText("packages/ui")).toBeInTheDocument();
  });

  test("lsSummary defaults to '.' when no path", () => {
    expect(lsSummary({}).text).toBe(".");
  });
});

describe("DefaultRenderer", () => {
  test("renders input + result sections", () => {
    render(<DefaultRenderer call={call("unknown", { foo: 1 }, { ok: true })} />);
    expect(screen.getByText("Input")).toBeInTheDocument();
    expect(screen.getByText("Result")).toBeInTheDocument();
  });

  test("uses 'Partial result' label when only partialResult is present", () => {
    const c = call("unknown", {}, undefined);
    c.partialResult = { tail: "still going" };
    render(<DefaultRenderer call={c} />);
    expect(screen.getByText("Partial result")).toBeInTheDocument();
  });
});
