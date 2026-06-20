import { describe, expect, test } from "bun:test";
import { estimateToolsTokens, estimateToolTokens, isMcpTool } from "../../src/host/mcp-tokens.js";

describe("estimateToolTokens", () => {
  test("counts chars/4 over name + description + schema", () => {
    // JSON.stringify({ name: "a", description: "", parameters: {} }) is 45 chars → ceil(45/4) = 12.
    expect(estimateToolTokens({ name: "a" })).toBe(12);
  });

  test("a richer definition costs more than a sparse one", () => {
    const sparse = estimateToolTokens({ name: "x" });
    const rich = estimateToolTokens({
      name: "x",
      description: "Does a lot of useful things across many systems.",
      parameters: { type: "object", properties: { path: { type: "string" } } },
    });
    expect(rich).toBeGreaterThan(sparse);
  });

  test("falls back to inputSchema when parameters is absent (cached tool shape)", () => {
    const fromParameters = estimateToolTokens({ name: "t", parameters: { type: "object" } });
    const fromInputSchema = estimateToolTokens({ name: "t", inputSchema: { type: "object" } });
    expect(fromInputSchema).toBe(fromParameters);
  });

  test("estimateToolsTokens sums the per-tool estimates", () => {
    const a = { name: "a" };
    const b = { name: "bee", description: "buzz" };
    expect(estimateToolsTokens([a, b])).toBe(estimateToolTokens(a) + estimateToolTokens(b));
    expect(estimateToolsTokens([])).toBe(0);
  });
});

describe("isMcpTool", () => {
  const ADAPTER = "/app/node_modules/pi-mcp-adapter/index.ts";

  test("matches the mcp proxy tool by name regardless of source", () => {
    expect(isMcpTool({ name: "mcp" })).toBe(true);
    expect(isMcpTool({ name: "mcp", sourceInfo: { path: "/elsewhere" } })).toBe(true);
  });

  test("matches direct-exposed tools by the resolved adapter path", () => {
    expect(isMcpTool({ name: "server_get_file", sourceInfo: { path: ADAPTER } }, ADAPTER)).toBe(
      true,
    );
  });

  test("matches by the pi-mcp-adapter path substring even without the resolved path", () => {
    expect(isMcpTool({ name: "server_search", sourceInfo: { path: ADAPTER } })).toBe(true);
  });

  test("rejects built-in tools", () => {
    expect(isMcpTool({ name: "read", sourceInfo: { path: "/app/dist/core/tools/read.js" } })).toBe(
      false,
    );
    expect(isMcpTool({ name: "bash" }, ADAPTER)).toBe(false);
  });
});
