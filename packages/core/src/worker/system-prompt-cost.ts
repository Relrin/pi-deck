/**
 * Helper for splitting the assembled system prompt into its base portion and the project-context
 * portion pi injects from `AGENTS.md`, `CLAUDE.md`, etc.
 *
 * pi only reports an *aggregate* context-token count, so the worker estimates the system prompt's
 * cost from `session.systemPrompt` (chars/4, see `emitContextCost`). For a project with a large
 * `AGENTS.md` that single figure is dominated by the injected context files, which is surprising in
 * the Context tab ("why is the system prompt 10k?"). This isolates that sub-portion so the breakdown
 * can show it as its own slice.
 *
 * pi's `buildSystemPrompt` (`@earendil-works/pi-coding-agent` >=0.79) wraps every project context
 * file in a single `<project_context> … </project_context>` envelope. We measure that span verbatim.
 * Best-effort and coupled to those literal markers: if pi changes them we return 0 (the cost folds
 * back into the base prompt) — we never throw and never inflate the total.
 */

const OPEN = "<project_context>";
const CLOSE = "</project_context>";

/**
 * Number of characters the `<project_context>` envelope (project instruction files) contributes to
 * the assembled system prompt. Returns 0 when the prompt has no such block (no context files, or the
 * marker is absent).
 */
export function projectContextChars(systemPrompt: string): number {
  const start = systemPrompt.indexOf(OPEN);
  if (start === -1) return 0;
  const end = systemPrompt.indexOf(CLOSE, start);
  if (end === -1) return 0;
  return end + CLOSE.length - start;
}
