import { z } from "zod";
import { AgentModeSchema } from "./session.js";

/**
 * Per-session metadata persisted alongside its project. Lets the rail render
 * branch + archived state on cold start without spawning a worker per session.
 */
export const SessionMetadataSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.string().datetime(),
  lastActivityAt: z.string().datetime(),
  archived: z.boolean().default(false),
  branch: z.string().optional(),
  /** Pi session file path, captured after the worker reports it. */
  sessionFile: z.string().optional(),
  /** Last permission mode the user set for this session. Restored on rehydrate. */
  agentMode: AgentModeSchema.optional(),
});

export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  path: z.string().min(1),
  displayName: z.string().min(1),
  createdAt: z.string().datetime(),
  lastOpenedAt: z.string().datetime(),
  sessionIds: z.array(z.string()),
  /** Per-session metadata map; absent on files written before this field was introduced. */
  sessions: z.record(z.string(), SessionMetadataSchema).optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const ProjectSummarySchema = ProjectSchema.pick({
  id: true,
  path: true,
  displayName: true,
  lastOpenedAt: true,
});

export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;
