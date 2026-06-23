import { z } from "zod";

/**
 * Thinking level vocabulary, mirrored from pi-ai's `ThinkingLevel`. The renderer treats `off`
 * as "no thinking"; the others are forwarded to pi via `AgentSession.setThinkingLevel` and
 * collapsed by the provider model's `thinkingLevelMap` when an exact match isn't supported.
 */
export const ThinkingLevelSchema = z.enum(["off", "minimal", "low", "medium", "high", "xhigh"]);
export type ThinkingLevel = z.infer<typeof ThinkingLevelSchema>;

/**
 * Agent permission mode. Picked on the intro composer and persisted onto the session record,
 * enforced in the worker by the agent-mode extension (see `extensions/agent-mode`):
 *  - `ask`          - confirm before every mutating tool call (edit / write / shell).
 *  - `accept-edits` - auto-apply in-project edits; still confirm every shell command.
 *  - `plan`         - read-only; non-read-only operations gated per `PlanGatePolicy`.
 *  - `auto`         - run edits and shell freely; only genuinely risky actions (mass delete,
 *                     secret/out-of-workspace writes, remote-pipe-to-shell, exfiltration) and
 *                     MCP invocations pause for approval, via a deterministic rule engine
 *                     (`auto-safety.ts`). "Fewer interruptions, less risk than no permissions."
 */
export const AgentModeSchema = z.enum(["ask", "accept-edits", "plan", "auto"]);
export type AgentMode = z.infer<typeof AgentModeSchema>;

/**
 * What plan mode does with an operation that isn't a pure read-only inspection (edits, writes,
 * mutating shell, MCP / network / other side-effecting tools):
 *  - `block`   — refuse it outright (strict "plan only, no changes" posture).
 *  - `approve` — prompt the user to allow or deny it (default; lets the user green-light a
 *                fetch / MCP call / one-off change without leaving plan mode).
 * Read-only operations always flow through regardless. Set globally in Settings - Tools and
 * captured per-session at creation (existing sessions keep their own).
 */
export const PlanGatePolicySchema = z.enum(["block", "approve"]);
export type PlanGatePolicy = z.infer<typeof PlanGatePolicySchema>;

/**
 * The (providerId, modelId) pair that uniquely identifies a model inside pi-ai's registry.
 * `providerId` matches pi's provider slug (e.g. `anthropic`, `openai`, `openrouter`, or any
 * custom provider key written to ~/.pi/agent/models.json by us).
 */
export const SessionModelRefSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
});
export type SessionModelRef = z.infer<typeof SessionModelRefSchema>;

export const SessionSummarySchema = z.object({
  id: z.string().min(1),
  projectId: z.string().uuid(),
  title: z.string().min(1),
  model: z.string().optional(),
  /** Structured model selection. Authoritative when present. */
  modelRef: SessionModelRefSchema.optional(),
  thinkingLevel: ThinkingLevelSchema.optional(),
  /** Agent permission mode picked on the composer; defaults to "plan" when absent. */
  agentMode: AgentModeSchema.optional(),
  /** When the session was first created. Drives the "sort by created" option in the rail
   * filter popover. Older persisted sessions may lack this — consumers should fall back to
   * `lastActivityAt` when it's absent. */
  createdAt: z.string().datetime().optional(),
  lastActivityAt: z.string().datetime(),
  /** Git branch snapshot captured at session creation; absent when project isn't a git repo. */
  branch: z.string().optional(),
  /** True once the user archived the session; absent is treated as `false` by consumers. */
  archived: z.boolean().optional(),
  /** Built-in / extension / custom tool names to disable for this session. */
  excludedTools: z.array(z.string().min(1)).optional(),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;
