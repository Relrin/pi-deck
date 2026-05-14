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
    forwardEvent(event, emit);
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

function forwardEvent(event: AgentSessionEvent, emit: EventEmitter): void {
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
      emit("turn.end", { message: event.message, toolResults: event.toolResults });
      return;
    default:
      return;
  }
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
