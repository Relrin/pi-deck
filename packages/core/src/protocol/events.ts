import { z } from "zod";
import { SessionModelRefSchema, ThinkingLevelSchema } from "../domain/session.js";
import { FsNodeSchema } from "../fs/types.js";
import { GitStatusSchema } from "../git/types.js";
import { themeListingSchema } from "./theme.js";

export const EVENT_SESSION_MESSAGE_DELTA = "session.message.delta" as const;
export const EVENT_SESSION_USER_MESSAGE = "session.user.message" as const;
export const EVENT_SESSION_TOOL_CALL_START = "session.tool.call.start" as const;
export const EVENT_SESSION_TOOL_CALL_UPDATE = "session.tool.call.update" as const;
export const EVENT_SESSION_TOOL_CALL_END = "session.tool.call.end" as const;
export const EVENT_SESSION_TURN_END = "session.turn.end" as const;
export const EVENT_SESSION_HISTORY_LOADED = "session.history.loaded" as const;
export const EVENT_SESSION_WORKER_EXIT = "session.worker.exit" as const;
export const EVENT_SESSION_AGENT_EVENT = "session.agent.event" as const;
export const EVENT_SESSION_MODEL_CHANGED = "session.model.changed" as const;
export const EVENT_SESSION_TOOL_APPROVAL_REQUESTED = "session.tool.approval.requested" as const;
export const EVENT_HOST_ERROR = "host.error" as const;
export const EVENT_HOST_READY = "host.ready" as const;
export const EVENT_THEME_CHANGED = "theme.changed" as const;
export const EVENT_PROVIDER_CHANGED = "provider.changed" as const;
export const EVENT_GIT_STATUS_CHANGED = "git.status.changed" as const;
export const EVENT_GIT_TURN_TOUCHES_CHANGED = "git.turnTouches.changed" as const;
export const EVENT_FS_TREE_CHANGED = "fs.tree.changed" as const;

export const SessionMessageDeltaPayload = z.object({
  sessionId: z.string(),
  /** Raw assistantMessageEvent from pi; renderer extracts text deltas. */
  event: z.unknown(),
  /** Full assistant message snapshot, for convenience. */
  message: z.unknown(),
});

export const SessionUserMessagePayload = z.object({
  sessionId: z.string(),
  messageId: z.string(),
  text: z.string(),
  createdAt: z.number(),
});

export const SessionToolCallStartPayload = z.object({
  sessionId: z.string(),
  callId: z.string(),
  name: z.string(),
  input: z.unknown(),
});

export const SessionToolCallUpdatePayload = z.object({
  sessionId: z.string(),
  callId: z.string(),
  name: z.string(),
  partialResult: z.unknown(),
});

export const SessionToolCallEndPayload = z.object({
  sessionId: z.string(),
  callId: z.string(),
  name: z.string(),
  result: z.unknown(),
  isError: z.boolean(),
});

/** Token counts reported by the AI provider for the just-finished assistant turn. */
export const TokenUsage = z.object({
  input: z.number(),
  output: z.number(),
  cacheRead: z.number(),
  cacheWrite: z.number(),
  total: z.number(),
});
export type TokenUsage = z.infer<typeof TokenUsage>;

/** Session-level context window state pulled from `AgentSession.getSessionStats()`. */
export const ContextUsage = z.object({
  /** Estimated context tokens; `null` right after compaction before the next LLM response. */
  tokens: z.number().nullable(),
  contextWindow: z.number(),
  percent: z.number().nullable(),
});
export type ContextUsage = z.infer<typeof ContextUsage>;

export const SessionTurnEndPayload = z.object({
  sessionId: z.string(),
  message: z.unknown(),
  toolResults: z.array(z.unknown()).optional(),
  cancelled: z.boolean().optional(),
  /** Per-turn token usage extracted from `message.usage`. */
  usage: TokenUsage.optional(),
  /** Cumulative context window usage at the end of this turn. */
  contextUsage: ContextUsage.optional(),
});

export const SessionWorkerExitPayload = z.object({
  sessionId: z.string(),
  code: z.number().nullable(),
  signal: z.string().nullable(),
});

/**
 * Snapshot of past session messages + tool calls, broadcast by the host after `activate`
 * resumes a session from its pi sessionFile. The renderer's messages store REPLACES the
 * session's contents with this payload so re-opening a saved session shows the prior
 * conversation. Always emitted on activate — fresh sessions just carry empty arrays.
 */
export const SessionHistoryToolCall = z.object({
  id: z.string().min(1),
  name: z.string(),
  input: z.unknown(),
  partialResult: z.unknown().optional(),
  result: z.unknown().optional(),
  status: z.enum(["pending", "running", "done", "error", "cancelled"]),
  errorText: z.string().optional(),
  startedAt: z.number(),
  endedAt: z.number().optional(),
});

export const SessionHistoryUserMessage = z.object({
  kind: z.literal("user"),
  id: z.string().min(1),
  text: z.string(),
  createdAt: z.number(),
});

export const SessionHistoryAssistantMessage = z.object({
  kind: z.literal("assistant"),
  id: z.string().min(1),
  text: z.string(),
  isComplete: z.literal(true),
  toolCallIds: z.array(z.string()),
  createdAt: z.number(),
  remoteTimestamp: z.number().optional(),
  model: z.string().optional(),
});

export const SessionHistoryMessage = z.discriminatedUnion("kind", [
  SessionHistoryUserMessage,
  SessionHistoryAssistantMessage,
]);

export const SessionHistoryLoadedPayload = z.object({
  sessionId: z.string(),
  messages: z.array(SessionHistoryMessage),
  toolCalls: z.array(SessionHistoryToolCall),
});

export const SessionAgentEventPayload = z.object({
  sessionId: z.string(),
  event: z.unknown(),
});

export const HostErrorPayload = z.object({
  message: z.string(),
  sessionId: z.string().optional(),
  cause: z.string().optional(),
});

export const HostReadyPayload = z.object({
  hostVersion: z.string(),
  protocolVersion: z.number().int(),
});

export const ThemeChangedPayload = z.object({
  activeName: z.string(),
  themes: z.array(themeListingSchema),
  /** Present when the active theme spec itself changed (live edit on disk). */
  spec: z.unknown().optional(),
});

/** Emitted when the active model selection for a session changes (renderer ↔ host ↔ worker). */
export const SessionModelChangedPayload = z.object({
  sessionId: z.string(),
  modelRef: SessionModelRefSchema,
  thinkingLevel: ThinkingLevelSchema.optional(),
});

/** Emitted when the provider catalogue, auth state, or custom-provider list changes. */
export const ProviderChangedPayload = z.object({
  /** Provider whose state changed; omitted for whole-list refreshes. */
  providerId: z.string().optional(),
});

/**
 * Pushed by the git watcher when `.git/HEAD`, `.git/index`, or `.git/refs/` change on disk —
 * or on the 5-second polling tick. The payload carries a fresh GitStatus so the renderer can
 * re-render without an extra round trip.
 */
export const GitStatusChangedPayload = z.object({
  projectId: z.string().min(1),
  status: GitStatusSchema,
});

/**
 * Pushed by the turn tracker when a tool call writes / edits a file. The renderer uses
 * `turnSeq` to drop snapshots from a prior turn; `paths` are absolute and may be filtered
 * by the active project root on the renderer side.
 */
export const GitTurnTouchesChangedPayload = z.object({
  sessionId: z.string().min(1),
  paths: z.array(z.string()),
  turnSeq: z.number().int().nonnegative(),
});

/**
 * Coalesced filesystem-change delta for a single project. The renderer's file-tree store
 * applies these to its in-memory tree without re-fetching the whole walk. Renames are
 * conveyed as (unlink + add) at both endpoints — the watcher doesn't try to detect a
 * single-op rename because the tree shape doesn't depend on the distinction.
 */
export const FsTreeChangedPayload = z.object({
  projectId: z.string().min(1),
  added: z.array(FsNodeSchema),
  removed: z.array(z.string()),
});

/**
 * Emitted by the agent-mode plugin when a tool call needs explicit user approval. The renderer
 * matches `toolCallId` against the live `session.tool.call.start` row to show an inline pill,
 * then calls `session.toolApproval` with the `approvalId` and the user's decision.
 */
export const SessionToolApprovalRequestedPayload = z.object({
  sessionId: z.string(),
  approvalId: z.string().min(1),
  toolCallId: z.string().min(1),
  toolName: z.string().min(1),
  input: z.unknown(),
  /** Optional hint from the plugin (e.g. "Edit target outside the auto-approve allowlist."). */
  reason: z.string().optional(),
});

export const EventSchemas = {
  [EVENT_SESSION_MESSAGE_DELTA]: SessionMessageDeltaPayload,
  [EVENT_SESSION_USER_MESSAGE]: SessionUserMessagePayload,
  [EVENT_SESSION_TOOL_CALL_START]: SessionToolCallStartPayload,
  [EVENT_SESSION_TOOL_CALL_UPDATE]: SessionToolCallUpdatePayload,
  [EVENT_SESSION_TOOL_CALL_END]: SessionToolCallEndPayload,
  [EVENT_SESSION_TURN_END]: SessionTurnEndPayload,
  [EVENT_SESSION_HISTORY_LOADED]: SessionHistoryLoadedPayload,
  [EVENT_SESSION_WORKER_EXIT]: SessionWorkerExitPayload,
  [EVENT_SESSION_AGENT_EVENT]: SessionAgentEventPayload,
  [EVENT_SESSION_MODEL_CHANGED]: SessionModelChangedPayload,
  [EVENT_HOST_ERROR]: HostErrorPayload,
  [EVENT_HOST_READY]: HostReadyPayload,
  [EVENT_THEME_CHANGED]: ThemeChangedPayload,
  [EVENT_PROVIDER_CHANGED]: ProviderChangedPayload,
  [EVENT_SESSION_TOOL_APPROVAL_REQUESTED]: SessionToolApprovalRequestedPayload,
  [EVENT_GIT_STATUS_CHANGED]: GitStatusChangedPayload,
  [EVENT_GIT_TURN_TOUCHES_CHANGED]: GitTurnTouchesChangedPayload,
  [EVENT_FS_TREE_CHANGED]: FsTreeChangedPayload,
} as const;

export type EventTopic = keyof typeof EventSchemas;
export type EventPayload<T extends EventTopic> = z.infer<(typeof EventSchemas)[T]>;

export const EVENT_TOPICS: readonly EventTopic[] = Object.keys(EventSchemas) as EventTopic[];
