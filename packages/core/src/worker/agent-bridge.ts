import { randomUUID } from "node:crypto";
import {
  type AgentSession,
  type AgentSessionEvent,
  AuthStorage,
  createAgentSession,
  ModelRegistry,
} from "@earendil-works/pi-coding-agent";
import type { SessionModelRef, ThinkingLevel } from "../domain/session.js";
import { validateAndChdir } from "./cwd.js";

export type EventEmitter = (topic: string, payload: unknown) => void;

export interface AgentBridge {
  session: AgentSession;
  sessionId: string;
  sessionFile: string;
  prompt: (text: string) => Promise<{ promptId: string }>;
  cancel: () => Promise<void>;
  setModel: (ref: SessionModelRef, thinkingLevel?: ThinkingLevel) => Promise<void>;
  setThinkingLevel: (level: ThinkingLevel) => void;
  dispose: () => void;
}

export interface InitParams {
  projectPath: string;
  sessionFile?: string;
  modelRef?: SessionModelRef;
  thinkingLevel?: ThinkingLevel;
}

/**
 * The pi-ai `ThinkingLevel` doesn't include `"off"`; we model "off" client-side as "skip
 * sending a level at all". This translates between the two vocabularies.
 */
type PiThinkingLevel = Exclude<ThinkingLevel, "off">;

function toPiThinkingLevel(level: ThinkingLevel | undefined): PiThinkingLevel | undefined {
  if (!level || level === "off") return undefined;
  return level;
}

export async function initBridge(params: InitParams, emit: EventEmitter): Promise<AgentBridge> {
  validateAndChdir(params.projectPath);

  // The worker constructs its own AuthStorage + ModelRegistry pointing at pi's default paths
  // (`~/.pi/agent/auth.json` / `~/.pi/agent/models.json`). The host writes both, so the
  // worker just reads the latest snapshot at spawn time.
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);

  const model = params.modelRef
    ? modelRegistry.find(params.modelRef.providerId, params.modelRef.modelId)
    : undefined;

  if (params.modelRef && !model) {
    // Surface a warning event but proceed with pi's resolution chain so we don't strand the
    // session — pi will fall back to the global default model.
    emit("agent.event", {
      type: "prompt_error",
      message: `Selected model ${params.modelRef.providerId}/${params.modelRef.modelId} is not registered; falling back to defaults.`,
    });
  }

  const thinkingLevel = toPiThinkingLevel(params.thinkingLevel);

  const { session } = await createAgentSession({
    cwd: params.projectPath,
    authStorage,
    modelRegistry,
    ...(model ? { model } : {}),
    ...(thinkingLevel ? { thinkingLevel } : {}),
  });

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
    setModel: async (ref: SessionModelRef, level?: ThinkingLevel) => {
      const next = modelRegistry.find(ref.providerId, ref.modelId);
      if (!next) {
        throw new Error(`Model ${ref.providerId}/${ref.modelId} is not registered`);
      }
      await session.setModel(next);
      const piLevel = toPiThinkingLevel(level);
      if (piLevel !== undefined) session.setThinkingLevel(piLevel);
    },
    setThinkingLevel: (level: ThinkingLevel) => {
      const piLevel = toPiThinkingLevel(level);
      // pi-ai has no "off" — when the user picks off we leave the level untouched. Callers
      // that genuinely want to disable thinking should pick a non-reasoning model.
      if (piLevel !== undefined) session.setThinkingLevel(piLevel);
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
