/**
 * Built-in pi-coding-agent tools we expose in the toggle UI.
 *
 * pi-coding-agent's default-on built-in set per `CreateAgentSessionOptions.tools` docstring
 * is `read, bash, edit, write`.
 *
 * The id MUST match pi's tool name verbatim — it's what we send as `excludeTools`.
 */
export interface ToolDescriptor {
  id: string;
  label: string;
  description: string;
}

export const BUILT_IN_TOOLS: readonly ToolDescriptor[] = [
  { id: "read", label: "read", description: "Read files from the project." },
  { id: "bash", label: "bash", description: "Run shell commands." },
  { id: "edit", label: "edit", description: "Modify existing files." },
  { id: "write", label: "write", description: "Create new files." },
] as const;

export const BUILT_IN_TOOL_IDS: readonly string[] = BUILT_IN_TOOLS.map((t) => t.id);
