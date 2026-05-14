import { randomUUID } from "node:crypto";
import {
  type AgentSession,
  type AgentSessionEvent,
  createAgentSession,
} from "@earendil-works/pi-coding-agent";
import { validateAndChdir } from "./cwd.js";

export type EventEmitter = (topic: string, payload: unknown) => void;

export interface AgentBridge {
  session: AgentSession;
  sessionId: string;
  sessionFile: string;
  prompt: (text: string) => Promise<{ promptId: string }>;
  cancel: () => Promise<void>;
  dispose: () => void;
}

export interface InitParams {
  projectPath: string;
  sessionFile?: string;
}

export async function initBridge(params: InitParams, emit: EventEmitter): Promise<AgentBridge> {
  validateAndChdir(params.projectPath);

  const { session } = await createAgentSession({ cwd: params.projectPath });

  const unsubscribe = session.subscribe((event: AgentSessionEvent) => {
    forwardEvent(event, emit, session);
  });

  return {
    session,
    sessionId: session.sessionId,
    sessionFile: session.sessionFile ?? "",
    prompt: async (text: string) => {
      const promptId = randomUUID();
      // Fire-and-forget; events stream via the subscription. Errors surface as host.error.
      session.prompt(text).catch((err: Error) => {
        emit("agent.event", { type: "prompt_error", message: err.message, promptId });
      });
      return { promptId };
    },
    cancel: async () => {
      await session.abort();
    },
    dispose: () => {
      unsubscribe();
      session.dispose();
    },
  };
}

function forwardEvent(event: AgentSessionEvent, emit: EventEmitter, session: AgentSession): void {
  // Always forward the raw event for debugging and plan-004 renderer use.
  emit("agent.event", event);

  // Normalize the most-used events into stable topic shapes.
  switch (event.type) {
    case "message_start": {
      const msg = event.message as { role?: string; content?: unknown; timestamp?: number };
      if (msg.role === "user") {
        emit("user.message", {
          messageId: randomUUID(),
          text: extractUserText(msg.content),
          createdAt: msg.timestamp ?? Date.now(),
        });
      }
      return;
    }
    case "message_update":
      emit("message.delta", { event: event.assistantMessageEvent, message: event.message });
      return;
    case "tool_execution_start":
      emit("tool.call.start", {
        callId: event.toolCallId,
        name: event.toolName,
        input: event.args,
      });
      return;
    case "tool_execution_update":
      emit("tool.call.update", {
        callId: event.toolCallId,
        name: event.toolName,
        partialResult: event.partialResult,
      });
      return;
    case "tool_execution_end":
      emit("tool.call.end", {
        callId: event.toolCallId,
        name: event.toolName,
        result: event.result,
        isError: event.isError,
      });
      return;
    case "turn_end":
      emit("turn.end", {
        message: event.message,
        toolResults: event.toolResults,
        usage: extractMessageUsage(event.message),
        contextUsage: session.getContextUsage(),
      });
      return;
    default:
      return;
  }
}

interface TokenUsageShape {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
}

/**
 * Pulls the per-turn token counts off pi's assistant message. The full pi-ai `Usage` type
 * carries `totalTokens` + a `cost` breakdown we don't need over the wire; we forward only
 * the integer counts to keep the payload small.
 */
function extractMessageUsage(message: unknown): TokenUsageShape | undefined {
  if (typeof message !== "object" || message === null) return undefined;
  const usage = (message as { usage?: unknown }).usage;
  if (typeof usage !== "object" || usage === null) return undefined;
  const u = usage as {
    input?: unknown;
    output?: unknown;
    cacheRead?: unknown;
    cacheWrite?: unknown;
    totalTokens?: unknown;
  };
  if (
    typeof u.input !== "number" ||
    typeof u.output !== "number" ||
    typeof u.cacheRead !== "number" ||
    typeof u.cacheWrite !== "number" ||
    typeof u.totalTokens !== "number"
  ) {
    return undefined;
  }
  return {
    input: u.input,
    output: u.output,
    cacheRead: u.cacheRead,
    cacheWrite: u.cacheWrite,
    total: u.totalTokens,
  };
}

function extractUserText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (block): block is { type: string; text: string } =>
        typeof block === "object" &&
        block !== null &&
        (block as { type?: unknown }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string",
    )
    .map((block) => block.text)
    .join("");
}
