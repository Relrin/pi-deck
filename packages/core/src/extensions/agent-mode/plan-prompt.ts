/**
 * Plan-mode system prompt assembly. We append a focused "Plan Mode" section to the original
 * system prompt pi-ai built for the turn so the agent keeps its tool descriptions and project
 * context but adopts a planning posture: read-only exploration (including read-only shell
 * commands), structured plan output, and a single durable plan file the renderer can pin.
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
 * explore via read-only tools and read-only shell commands, produce a single structured plan
 * as its final message, and also overwrite the per-session plan file so the plan survives
 * restarts.
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
    "When the request is clear enough, you MUST save the plan to the file with the write",
    "tool. Any further updates also should be applied and reflected in the plan file. Write " +
      "it to exactly this path (do not invent another filename like `plan.md` or `structure-design.md`):",
    "",
    `  ${planFilePath}`,
    "",
    "Structure the file as GitHub-flavored markdown: first an H1 title line",
    "`# <short imperative title>` naming what the plan accomplishes, then these sections in order:",
    "",
    "  1. **Context** — one or two sentences on why this change.",
    "  2. **Plan** — a checklist using `- [ ] **LABEL** — task` items, one concrete step each.",
    "     LABEL is a short one- or two-word operation tag in CAPS (e.g. EXPLORE, DESIGN, WRITE,",
    "     WIRE, TEST). The label is optional — write just `- [ ] task` when no tag fits.",
    "  3. **Files to touch** — repo-relative paths with a short note per file.",
    "  4. **Verification** — how the user (or you, after approval) will confirm it works.",
    "",
    "Then also present the same plan as your final assistant message so the user can review it",
    "inline. Overwrite the plan file in place whenever you revise — it is the *current* plan.",
    "End the plan file with this execution note, verbatim, so the convention travels with the plan",
    "into execution (the user need not repeat it on approval):",
    "",
    "  _Execution: mark each step `[~]` when you start it and `[x]` when it's done._",
    "",
    "After approval you keep working and using the same plan file. As you go, EDIT that existing plan file",
    `(\`${planFilePath}\`) with the edit tool to change each step's \`- [ ]\` → \`- [~]\` (starting)`,
    "→ `- [x]` (done).",
    "",
    'End the message with: "Reply with feedback to revise this plan, or approve to switch to execution."',
  ].join("\n");
}
