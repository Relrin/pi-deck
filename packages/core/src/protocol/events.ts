import { z } from "zod";

export const EVENT_SESSION_MESSAGE_DELTA = "session.message.delta" as const;
export const EVENT_SESSION_USER_MESSAGE = "session.user.message" as const;
export const EVENT_SESSION_TOOL_CALL_START = "session.tool.call.start" as const;
export const EVENT_SESSION_TOOL_CALL_UPDATE = "session.tool.call.update" as const;
export const EVENT_SESSION_TOOL_CALL_END = "session.tool.call.end" as const;
export const EVENT_SESSION_TURN_END = "session.turn.end" as const;
export const EVENT_SESSION_WORKER_EXIT = "session.worker.exit" as const;
export const EVENT_SESSION_AGENT_EVENT = "session.agent.event" as const;
export const EVENT_HOST_ERROR = "host.error" as const;
export const EVENT_HOST_READY = "host.ready" as const;

export const SessionMessageDeltaPayload = z.object({
  sessionId: z.string(),
  /** Raw assistantMessageEvent from pi; renderer extracts text deltas in plan 004. */
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

export const SessionTurnEndPayload = z.object({
  sessionId: z.string(),
  message: z.unknown(),
  toolResults: z.array(z.unknown()).optional(),
  cancelled: z.boolean().optional(),
});

export const SessionWorkerExitPayload = z.object({
  sessionId: z.string(),
  code: z.number().nullable(),
  signal: z.string().nullable(),
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

export const EventSchemas = {
  [EVENT_SESSION_MESSAGE_DELTA]: SessionMessageDeltaPayload,
  [EVENT_SESSION_USER_MESSAGE]: SessionUserMessagePayload,
  [EVENT_SESSION_TOOL_CALL_START]: SessionToolCallStartPayload,
  [EVENT_SESSION_TOOL_CALL_UPDATE]: SessionToolCallUpdatePayload,
  [EVENT_SESSION_TOOL_CALL_END]: SessionToolCallEndPayload,
  [EVENT_SESSION_TURN_END]: SessionTurnEndPayload,
  [EVENT_SESSION_WORKER_EXIT]: SessionWorkerExitPayload,
  [EVENT_SESSION_AGENT_EVENT]: SessionAgentEventPayload,
  [EVENT_HOST_ERROR]: HostErrorPayload,
  [EVENT_HOST_READY]: HostReadyPayload,
} as const;

export type EventTopic = keyof typeof EventSchemas;
export type EventPayload<T extends EventTopic> = z.infer<(typeof EventSchemas)[T]>;

export const EVENT_TOPICS: readonly EventTopic[] = Object.keys(EventSchemas) as EventTopic[];
