import { randomUUID } from "node:crypto";
import {
  type AgentSession,
  type AgentSessionEvent,
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRegistry,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { AgentMode, SessionModelRef, ThinkingLevel } from "../domain/session.js";
import { type ApprovalDecision, createAgentModeExtension } from "../extensions/agent-mode/index.js";
import { createAttachmentsExtension } from "../extensions/attachments/index.js";
import { listProjectFiles } from "../git/files.js";
import type { PromptAttachment, PromptImage } from "../protocol/commands.js";
import { EVENT_SESSION_TOOL_APPROVAL_REQUESTED } from "../protocol/events.js";
import { validateAndChdir } from "./cwd.js";

export type EventEmitter = (topic: string, payload: unknown) => void;

export interface AgentBridge {
  session: AgentSession;
  sessionId: string;
  sessionFile: string;
  prompt: (text: string, opts?: { images?: PromptImage[] }) => Promise<{ promptId: string }>;
  cancel: () => Promise<void>;
  setModel: (ref: SessionModelRef, thinkingLevel?: ThinkingLevel) => Promise<void>;
  setThinkingLevel: (level: ThinkingLevel) => void;
  /** Switch agent mode for the next turn (and onwards, until called again). */
  setAgentMode: (mode: AgentMode) => void;
  /** Stage attachments to be materialized at the start of the next turn. */
  setPendingAttachments: (attachments: PromptAttachment[]) => void;
  /** Replace the auto-approve edit allowlist used by `accept-edits` mode. */
  setEditAllowlist: (paths: string[]) => void;
  /** Resolve a pending tool-call approval (allow / deny). */
  resolveApproval: (approvalId: string, decision: ApprovalDecision, reason?: string) => void;
  dispose: () => void;
}

export interface InitParams {
  projectPath: string;
  sessionFile?: string;
  modelRef?: SessionModelRef;
  thinkingLevel?: ThinkingLevel;
  agentMode?: AgentMode;
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

  // Built-in plugins: agent-mode (enforce composer permissions) + attachments (materialize
  // staged files into a custom message on the next turn). Each plugin owns its own state via
  // its returned controller; agent-bridge composes them and exposes setters on AgentBridge.
  const agentModeController = createAgentModeExtension({
    projectPath: params.projectPath,
    initialMode: params.agentMode ?? "plan",
    onApprovalRequest: (request) => {
      emit(EVENT_SESSION_TOOL_APPROVAL_REQUESTED, request);
    },
  });
  const attachmentsController = createAttachmentsExtension({
    projectPath: params.projectPath,
    listProjectFiles: (cwd, limit) => listProjectFiles(cwd, limit),
  });

  const agentDir = getAgentDir();
  const resourceLoader = new DefaultResourceLoader({
    cwd: params.projectPath,
    agentDir,
    settingsManager: SettingsManager.create(params.projectPath, agentDir),
    extensionFactories: [agentModeController.factory, attachmentsController.factory],
  });
  // pi 0.74's `createAgentSession` only auto-calls `reload()` on the loader it constructs
  // itself; when we pass our own (which we must, to register the inline factories), we own
  // the lifecycle. Without this call the factories never run, so `pi.on("input", ...)` and
  // `pi.on("tool_call", ...)` are never registered and our built-in extensions are silent
  // no-ops.
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    cwd: params.projectPath,
    authStorage,
    modelRegistry,
    resourceLoader,
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
    prompt: async (text: string, opts?: { images?: PromptImage[] }) => {
      const promptId = randomUUID();
      // pi's ImageContent uses { type: "image", mimeType, data }. Map our protocol shape
      // (mimeType + base64 data) directly onto it. The `name` is renderer-only metadata.
      const piImages = opts?.images?.map((i) => ({
        type: "image" as const,
        mimeType: i.mimeType,
        data: i.data,
      }));
      const promptOpts = piImages && piImages.length > 0 ? { images: piImages } : undefined;
      // Fire-and-forget; events stream via the subscription. Errors surface as host.error.
      session.prompt(text, promptOpts).catch((err: Error) => {
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
    setAgentMode: (mode) => {
      agentModeController.setMode(mode);
    },
    setPendingAttachments: (attachments) => {
      attachmentsController.setPending(attachments);
    },
    setEditAllowlist: (paths) => {
      agentModeController.setEditAllowlist(paths);
    },
    resolveApproval: (approvalId, decision, reason) => {
      agentModeController.resolveApproval(approvalId, decision, reason);
    },
    dispose: () => {
      unsubscribe();
      agentModeController.dispose();
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
  if (typeof content === "string") return stripAttachmentsBlock(content);
  if (!Array.isArray(content)) return "";
  const joined = content
    .filter(
      (block): block is { type: string; text: string } =>
        typeof block === "object" &&
        block !== null &&
        (block as { type?: unknown }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string",
    )
    .map((block) => block.text)
    .join("");
  return stripAttachmentsBlock(joined);
}

/**
 * The built-in attachments extension prepends an `<attachments>…</attachments>` block to
 * the user's typed text via pi's `input` transform so the LLM sees attachments inside the
 * same user turn (see `extensions/attachments/attachments.ts`). The renderer should still
 * display only what the user actually typed, so strip a leading attachments block if one
 * is present. Match is anchored to the start to avoid clobbering text where the user
 * literally typed `<attachments>` later in the message.
 */
export function stripAttachmentsBlock(text: string): string {
  if (!text.startsWith("<attachments>")) return text;
  const end = text.indexOf("</attachments>");
  if (end === -1) return text;
  let cursor = end + "</attachments>".length;
  // Consume the blank-line separator we emit between the block and the user's text.
  if (text.startsWith("\n\n", cursor)) cursor += 2;
  else if (text.startsWith("\n", cursor)) cursor += 1;
  return text.slice(cursor);
}
