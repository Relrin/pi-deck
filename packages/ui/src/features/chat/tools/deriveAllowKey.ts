/**
 * Derive a short, user-readable "rule key" for the auto-allow checkbox label.
 *
 * - For `bash` / `shell`: the first whitespace-separated token of the command (so
 *   `mkdir -p ~/.config/pi/mcp` becomes `mkdir`). This matches the screenshot's
 *   "always allow mkdir" wording and keeps the allowlist granularity at the
 *   *executable* level — ticking it on `mkdir` doesn't whitelist arbitrary `rm`.
 * - For every other tool: the tool name itself (so `read`, `edit`, `grep`, ...).
 *
 * The function never throws; if the input shape is unexpected we fall back to the tool
 * name to keep the UI rendering — a wrong-but-coarse key is better than blowing up the
 * pill on a malformed payload.
 */
export function deriveAllowKey(toolName: string, input: unknown): string {
  if (toolName === "bash" || toolName === "shell") {
    const cmd = extractCommand(input);
    if (cmd) {
      const first = cmd.trim().split(/\s+/, 1)[0];
      if (first) return first;
    }
  }
  return toolName;
}

function extractCommand(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const candidate = (input as { command?: unknown }).command;
  return typeof candidate === "string" ? candidate : undefined;
}
