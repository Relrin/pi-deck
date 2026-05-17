import { z } from "zod";

/**
 * Thinking level vocabulary, mirrored from pi-ai's `ThinkingLevel`. The renderer treats `off`
 * as "no thinking"; the others are forwarded to pi via `AgentSession.setThinkingLevel` and
 * collapsed by the provider model's `thinkingLevelMap` when an exact match isn't supported.
 */
export const ThinkingLevelSchema = z.enum(["off", "minimal", "low", "medium", "high", "xhigh"]);
export type ThinkingLevel = z.infer<typeof ThinkingLevelSchema>;

/**
 * Agent permission mode. Picked on the intro composer and persisted onto the session record.
 * The agent loop will eventually enforce these — for now the field is stored but not gating.
 */
export const AgentModeSchema = z.enum(["ask", "accept-edits", "plan"]);
export type AgentMode = z.infer<typeof AgentModeSchema>;

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
  /** Legacy flat string kept for backwards-compat with plan 003/004 callers. */
  model: z.string().optional(),
  /** Structured model selection introduced by plan 006. Authoritative when present. */
  modelRef: SessionModelRefSchema.optional(),
  thinkingLevel: ThinkingLevelSchema.optional(),
  /** Agent permission mode picked on the composer; defaults to "plan" when absent. */
  agentMode: AgentModeSchema.optional(),
  lastActivityAt: z.string().datetime(),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;
