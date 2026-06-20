import { describe, expect, test } from "bun:test";
import { DefaultRenderer } from "../../../../../src/features/chat/tools/renderers/DefaultRenderer";
import {
  FindRenderer,
  findSummary,
} from "../../../../../src/features/chat/tools/renderers/FindRenderer";
import {
  GrepRenderer,
  grepSummary,
} from "../../../../../src/features/chat/tools/renderers/GrepRenderer";
import { LsRenderer, lsSummary } from "../../../../../src/features/chat/tools/renderers/LsRenderer";
import {
  McpRenderer,
  mcpSummary,
} from "../../../../../src/features/chat/tools/renderers/McpRenderer";
import {
  ReadRenderer,
  readSummary,
} from "../../../../../src/features/chat/tools/renderers/ReadRenderer";
import {
  WriteRenderer,
  writeSummary,
} from "../../../../../src/features/chat/tools/renderers/WriteRenderer";
import type { ToolCallEntry } from "../../../../../src/features/chat/types";
import { render, screen } from "../../../../utils";

function call(name: string, input: unknown, result?: unknown): ToolCallEntry {
  return { id: "t", name, status: "done", startedAt: 1, input, result };
}

// The renderers intentionally do NOT repeat the path / pattern that the tool-call header
// already shows (e.g. "READ · /a.ts"). These tests check the secondary detail that the
// expanded body renders on top of the file output.

describe("ReadRenderer", () => {
  test("renders file body", () => {
    render(
      <ReadRenderer
        call={call("read", { path: "/a.ts" }, { content: [{ type: "text", text: "file body" }] })}
      />,
    );
    expect(screen.getByLabelText("File contents").textContent).toContain("file body");
  });

  test("renders offset + limit when present", () => {
    render(
      <ReadRenderer call={call("read", { path: "/a.ts", offset: 40, limit: 80 }, undefined)} />,
    );
    expect(screen.getByText("offset 40")).toBeInTheDocument();
    expect(screen.getByText("limit 80")).toBeInTheDocument();
  });

  test("summary truncates long paths in the middle and exposes the full path as title", () => {
    const out = readSummary({ path: `/a/b/c/${"x".repeat(200)}/file.ts` });
    expect(out.title?.length).toBeGreaterThan(out.text?.length ?? 0);
    expect(out.text).toContain("…");
  });
});

describe("WriteRenderer", () => {
  // With a path + content the renderer now shows the Pierre diff (covered in
  // EditRenderer.test / toolFileDiff.test, which stub the worker pool). The plain code-block
  // fallback only remains for the edge case of content arriving without a path — exercised
  // here because it doesn't mount Pierre.
  test("falls back to a code block when content has no path", () => {
    render(<WriteRenderer call={call("write", { content: "new file body" })} />);
    expect(screen.getByLabelText("File contents to write").textContent).toContain("new file body");
  });

  test("writeSummary returns path as title + truncated text", () => {
    const out = writeSummary({ path: "/short.ts" });
    expect(out.title).toBe("/short.ts");
  });
});

describe("GrepRenderer", () => {
  test("renders modifiers (path / glob / case)", () => {
    render(
      <GrepRenderer
        call={call(
          "grep",
          { pattern: "TODO", path: "src", glob: "*.ts", ignoreCase: true },
          { content: [{ type: "text", text: "src/a.ts:1:TODO\n" }] },
        )}
      />,
    );
    expect(screen.getByText("in src")).toBeInTheDocument();
    expect(screen.getByText("glob *.ts")).toBeInTheDocument();
    expect(screen.getByText("case-insensitive")).toBeInTheDocument();
  });

  test("grepSummary wraps the pattern in quotes", () => {
    expect(grepSummary({ pattern: "hello" }).text).toBe('"hello"');
  });
});

describe("FindRenderer", () => {
  test("renders the path scope", () => {
    render(
      <FindRenderer call={call("find", { pattern: "*.ts", path: "src" }, "src/a.ts\nsrc/b.ts")} />,
    );
    expect(screen.getByText("in src")).toBeInTheDocument();
  });

  test("findSummary returns the pattern", () => {
    expect(findSummary({ pattern: "foo" }).text).toBe("foo");
  });
});

describe("LsRenderer", () => {
  test("renders the directory listing body", () => {
    render(<LsRenderer call={call("ls", { path: "packages/ui" }, "src/\ntest/\n")} />);
    expect(screen.getByLabelText("Directory listing").textContent).toContain("src/");
  });

  test("lsSummary defaults to '.' when no path", () => {
    expect(lsSummary({}).text).toBe(".");
  });
});

describe("McpRenderer", () => {
  test("mcpSummary surfaces the real tool name (with full title)", () => {
    const out = mcpSummary({ tool: "exa_web_search_exa", args: '{"query":"x"}' });
    expect(out.text).toBe("exa_web_search_exa");
    expect(out.title).toBe("exa_web_search_exa");
  });

  test("mcpSummary returns empty when the tool name isn't a string yet (streaming)", () => {
    expect(mcpSummary({})).toEqual({});
    expect(mcpSummary(null)).toEqual({});
  });

  test("renders the tool name and parses a JSON-string args payload", () => {
    render(
      <McpRenderer
        call={call(
          "mcp",
          { tool: "exa_web_search_exa", args: '{"query":"what is the day today"}' },
          { content: [{ type: "text", text: "today is Friday" }] },
        )}
      />,
    );
    expect(screen.getByText("Tool")).toBeInTheDocument();
    expect(screen.getByText("exa_web_search_exa")).toBeInTheDocument();
    expect(screen.getByText("Arguments")).toBeInTheDocument();
    // The escaped JSON string is parsed and pretty-printed, so the key appears unquoted-as-string.
    expect(screen.getByText(/"query": "what is the day today"/)).toBeInTheDocument();
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.getByText("today is Friday")).toBeInTheDocument();
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
