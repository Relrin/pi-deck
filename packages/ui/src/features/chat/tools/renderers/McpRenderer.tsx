import type { ToolRendererProps, ToolSummarizer } from "../types.js";
import { extractTextContent } from "./common.js";
import { Section } from "./DefaultRenderer.js";

/**
 * The MCP adapter exposes every server tool through a single `mcp` proxy tool, so pi reports
 * the tool call as `name: "mcp"` with the *real* tool in `input.tool` and its arguments in
 * `input.args` (a JSON-encoded string or object). Without special handling the card header
 * just reads "MCP" and the actual tool is hidden until you expand the row — so:
 *   - `mcpSummary` surfaces the real tool name inline in the collapsed header, and
 *   - `McpRenderer` splits the expanded body into Tool / Arguments / Result instead of
 *     dumping the raw `{ tool, args }` wrapper (where `args` shows as an escaped string).
 */
interface McpInput {
  tool?: unknown;
  args?: unknown;
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** The adapter passes `args` as a JSON string; parse it for display, falling back to the raw value. */
function parseArgs(args: unknown): unknown {
  if (typeof args === "string") {
    try {
      return JSON.parse(args);
    } catch {
      return args;
    }
  }
  return args;
}

export const mcpSummary: ToolSummarizer = (input) => {
  const tool = (input as McpInput | null)?.tool;
  if (typeof tool !== "string" || !tool) return {};
  return { text: tool, title: tool };
};

export function McpRenderer({ call }: ToolRendererProps) {
  const input = (call.input ?? {}) as McpInput;
  const tool = typeof input.tool === "string" ? input.tool : undefined;
  const args = parseArgs(input.args);
  const hasArgs = args !== undefined && args !== null && args !== "";

  const partial = call.result === undefined && call.partialResult !== undefined;
  const resultRaw = call.result ?? call.partialResult;
  const hasResult = call.result !== undefined || call.partialResult !== undefined;
  const resultText = extractTextContent(resultRaw);

  return (
    <div className="space-y-2 font-mono">
      {tool && (
        <Section label="Tool">
          <pre className="whitespace-pre-wrap break-words text-[var(--color-text)] m-0">{tool}</pre>
        </Section>
      )}
      {hasArgs && (
        <Section label="Arguments">
          <pre className="whitespace-pre-wrap break-words text-[var(--color-text)] m-0">
            {prettyJson(args)}
          </pre>
        </Section>
      )}
      {hasResult && (
        <Section label={partial ? "Partial result" : "Result"}>
          <pre className="whitespace-pre-wrap break-words text-[var(--color-text)] m-0">
            {resultText || prettyJson(resultRaw)}
          </pre>
        </Section>
      )}
    </div>
  );
}
