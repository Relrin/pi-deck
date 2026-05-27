/**
 * Plan-mode system prompt assembly. We append a focused "Plan Mode" section to the original
 * system prompt pi-ai built for the turn so the agent keeps its tool descriptions and project
 * context but adopts a planning posture: read-only exploration, structured plan output, and a
 * single durable plan file the renderer can pin.
 *
 * Kept in one place so the wording is reviewable and easy to tune without touching the hook
 * site in `agent-mode.ts`.
 */

export interface ComposePlanPromptOptions {
  /** Absolute path of the per-session plan file the agent should overwrite. */
  planFilePath: string;
}

const PLAN_MODE_HEADER = "# Plan Mode";

/**
 * Append plan-mode instructions to pi-ai's assembled system prompt. The agent is told to
 * explore via read-only tools, produce a single structured plan as its final message, and
 * also overwrite the per-session plan file so the plan survives restarts.
 */
export function composePlanPrompt(originalPrompt: string, opts: ComposePlanPromptOptions): string {
  return `${originalPrompt.trimEnd()}\n\n${PLAN_MODE_HEADER}\n${planSection(opts.planFilePath)}\n`;
}

function planSection(planFilePath: string): string {
  return [
    "You are in plan mode. Do not execute mutating commands or edit files this turn —",
    "except for the plan file itself (see below). Other writes will be blocked by the host.",
    "",
    "Use read-only tools (read, grep, glob, web fetch) to research about the problem and prepare",
    "code before you commit to anything. If the request is ambiguous, ask focused clarifying",
    "questions as your final message and stop — the user answers in their next turn.",
    "",
    "When the request is clear enough, produce a plan as your final assistant message. Structure",
    "it as GitHub-flavored markdown with these sections, in order:",
    "",
    "  1. **Context** — one or two sentences on why this change.",
    "  2. **Plan** — a checklist using `- [ ] task` items. Each item is one concrete step.",
    "  3. **Files to touch** — repo-relative paths with a short note per file.",
    "  4. **Verification** — how the user (or you, after approval) will confirm it works.",
    "",
    `Also write the same content to the plan file at \`${planFilePath}\` using the write or edit`,
    "tool. Overwrite the file in place — it represents the *current* plan. If the",
    "directory does not exist yet, the write tool will create it.",
    "",
    'End the message with: "Reply with feedback to revise this plan, or approve to switch to execution."',
  ].join("\n");
}
