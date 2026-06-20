/**
 * Shared token-cost estimator for MCP tool definitions.
 *
 * pi only reports an *aggregate* context-token count (`AgentSession.getContextUsage()`), so the
 * share consumed by MCP tools can't be read back exactly. We estimate it instead, from the real
 * tool definitions the model actually receives, using the same chars/4 heuristic pi and pi-deck
 * already use for messages. Two callers feed this:
 *   - the worker, over `session.getAllTools()` filtered to MCP-origin tools (the live, as-sent set);
 *   - the host, over the adapter's `mcp-cache.json` tool metadata (per-server, no live session).
 * Keeping the math here means both never drift.
 */

/** A tool-ish shape from either source: pi's `ToolInfo` (`parameters`) or a cached tool (`inputSchema`). */
export interface ToolLike {
  name?: string;
  description?: string;
  /** pi `ToolInfo` carries the JSON schema here. */
  parameters?: unknown;
  /** The adapter's cached tools carry it here. */
  inputSchema?: unknown;
}

/**
 * Estimate the tokens a single tool definition contributes to the model's tool payload. We
 * serialize the parts that are actually sent — name, description, and parameter schema — and
 * divide chars by 4 (conservative; tends to slightly overestimate, matching pi's `estimateTokens`).
 */
export function estimateToolTokens(def: ToolLike): number {
  const json = JSON.stringify({
    name: def.name ?? "",
    description: def.description ?? "",
    parameters: def.parameters ?? def.inputSchema ?? {},
  });
  return Math.ceil(json.length / 4);
}

/** Sum the estimated token cost across a set of tool definitions. */
export function estimateToolsTokens(defs: ReadonlyArray<ToolLike>): number {
  let total = 0;
  for (const def of defs) total += estimateToolTokens(def);
  return total;
}

/** Substring identifying the pi-mcp-adapter in a tool's `sourceInfo.path`. */
const ADAPTER_PATH_HINT = "pi-mcp-adapter";

/** A pi `ToolInfo`-ish shape carrying the registering extension's source path. */
export interface ToolWithSource {
  name: string;
  sourceInfo?: { path?: string };
}

/**
 * Whether a registered tool originates from the MCP adapter. The adapter registers a single `mcp`
 * proxy tool plus any direct-exposed tools, all tagged with the adapter's extension path. We match
 * belt-and-suspenders: the resolved adapter path (when known), a `pi-mcp-adapter` path substring
 * (survives path-normalisation differences across platforms), and the literal `mcp` proxy name.
 */
export function isMcpTool(tool: ToolWithSource, adapterPath?: string): boolean {
  if (tool.name === "mcp") return true;
  const path = tool.sourceInfo?.path ?? "";
  if (adapterPath && path === adapterPath) return true;
  return path.includes(ADAPTER_PATH_HINT);
}
