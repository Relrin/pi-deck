import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join as pathJoin } from "node:path";
import {
  type AgentSession,
  type AgentSessionEvent,
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  type ExtensionAPI,
  type ExtensionFactory,
  getAgentDir,
  ModelRegistry,
  SessionManager as PiSessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type {
  AgentMode,
  PlanGatePolicy,
  SessionModelRef,
  ThinkingLevel,
} from "../domain/session.js";
import { type ApprovalDecision, createAgentModeExtension } from "../extensions/agent-mode/index.js";
import { createAskUserExtension, createDeferredFrontend } from "../extensions/ask-user/index.js";
import { createAttachmentsExtension } from "../extensions/attachments/index.js";
import { listProjectFiles } from "../git/files.js";
import { estimateToolTokens, isMcpTool } from "../host/mcp-tokens.js";
import type {
  AskUserAnswer,
  PromptAttachment,
  PromptImage,
  SessionCommandInfo,
} from "../protocol/commands.js";
import {
  EVENT_SESSION_ASK_USER_REQUESTED,
  EVENT_SESSION_CONTEXT_COST,
  EVENT_SESSION_TOOL_APPROVAL_REQUESTED,
} from "../protocol/events.js";
import { validateAndChdir } from "./cwd.js";
import { projectContextChars } from "./system-prompt-cost.js";

export type EventEmitter = (topic: string, payload: unknown) => void;

/**
 * Absolute path to the bundled pi-mcp-adapter extension entry (TypeScript source pi loads via
 * jiti), or undefined when the package isn't installed. Resolved from this module's location,
 * which at runtime lives alongside the desktop app's node_modules.
 */
function resolveMcpAdapterPath(): string | undefined {
  try {
    return createRequire(import.meta.url).resolve("pi-mcp-adapter/index.ts");
  } catch {
    return undefined;
  }
}

/**
 * True when the project's `.pi/mcp.json` (or the agent's global `mcp.json`) defines at least one
 * server. We only load the adapter then, so projects without MCP don't pay for its proxy tool.
 */
async function hasMcpServers(projectPath: string, agentDir: string): Promise<boolean> {
  for (const file of [pathJoin(projectPath, ".pi", "mcp.json"), pathJoin(agentDir, "mcp.json")]) {
    try {
      const parsed = JSON.parse(await readFile(file, "utf8")) as { mcpServers?: unknown };
      const servers = parsed.mcpServers;
      if (servers && typeof servers === "object" && Object.keys(servers).length > 0) return true;
    } catch {
      /* missing / malformed config is fine */
    }
  }
  return false;
}

export interface HistoryToolCall {
  id: string;
  name: string;
  input: unknown;
  partialResult?: unknown;
  result?: unknown;
  status: "pending" | "running" | "done" | "error" | "cancelled";
  errorText?: string;
  startedAt: number;
  endedAt?: number;
}

export type HistoryMessage =
  | { kind: "user"; id: string; text: string; createdAt: number }
  | {
      kind: "assistant";
      id: string;
      text: string;
      isComplete: true;
      toolCallIds: string[];
      createdAt: number;
      remoteTimestamp?: number;
      model?: string;
    };

export interface HistorySnapshot {
  messages: HistoryMessage[];
  toolCalls: HistoryToolCall[];
}

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
  /** Resume a suspended `ask_user_question` tool call with the user's answer. */
  answerQuestion: (askId: string, answer: AskUserAnswer) => void;
  /** Snapshot of all past messages + tool calls so the renderer can re-paint a resumed chat. */
  getHistory: () => HistorySnapshot;
  /** Slash commands pi will recognize in `prompt()`: extension commands, templates, skills. */
  getCommands: () => SessionCommandInfo[];
  /**
   * User-message anchor points pi allows rewinding/forking to, in branch order. The renderer
   * maps the k-th user bubble to the k-th entry here (see agent-bridge history threading note).
   */
  getForkPoints: () => Array<{ entryId: string; text: string }>;
  /**
   * Rewind the conversation to before `entryId` (pi `navigateTree`). Returns the rewound-to
   * user message text (to pre-fill the composer) and the new leaf id, which the host re-applies
   * across worker respawns until a fresh turn persists the branch. In-memory only until then —
   * see the "Rewind durability" note in the plan.
   */
  rewindTo: (entryId: string) => Promise<{ editorText?: string; leafId: string | null }>;
  /** Re-apply a rewind leaf after a worker respawn, before any new turn is appended. */
  applyLeaf: (leafId: string) => void;
  /**
   * Branch the tree at `entryId` into a standalone session file (pi `createBranchedSession`),
   * mirroring pi's own fork: for a user message we branch *before* it and hand its text back to
   * pre-fill the fork's composer. Returns the new file path (undefined when forking before the
   * first entry — the host then creates a fresh empty session).
   */
  forkAt: (entryId: string) => { sessionFile: string | undefined; editorText?: string };
  dispose: () => void;
}

export interface InitParams {
  projectPath: string;
  sessionFile?: string;
  modelRef?: SessionModelRef;
  thinkingLevel?: ThinkingLevel;
  agentMode?: AgentMode;
  /** Plan-mode policy for non-read-only operations: `block` or `approve` (default). */
  planGatePolicy?: PlanGatePolicy;
  /**
   * Tool ids to drop from this session before the SDK registers them. Forwarded straight
   * to `createAgentSession({ excludeTools })`. The SDK has no setter for this after
   * construction, so changes mid-session come in via a worker restart from the host.
   */
  excludedTools?: string[];
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

/**
 * Estimate this session's fixed context overhead and emit it to the host: the system prompt text,
 * the built-in tool definitions, and the MCP tool definitions. pi only reports an aggregate token
 * count, so we derive these from the real artefacts it holds — `session.systemPrompt` and
 * `session.getAllTools()` — with the same chars/4 heuristic pi uses internally. This lets the
 * Context tab attribute each slice instead of guessing with constants. Best-effort: a failure here
 * must never break session startup.
 */
function emitContextCost(
  session: AgentSession,
  adapterPath: string | undefined,
  emit: EventEmitter,
): void {
  try {
    let builtinTools = 0;
    let mcp = 0;
    let mcpToolCount = 0;
    for (const tool of session.getAllTools()) {
      if (isMcpTool(tool, adapterPath)) {
        mcp += estimateToolTokens(tool);
        mcpToolCount += 1;
      } else {
        builtinTools += estimateToolTokens(tool);
      }
    }
    emit(EVENT_SESSION_CONTEXT_COST, {
      systemPrompt: Math.ceil(session.systemPrompt.length / 4),
      projectContext: Math.ceil(projectContextChars(session.systemPrompt) / 4),
      builtinTools,
      mcp,
      mcpToolCount,
    });
  } catch {
    // Non-fatal: the Context tab falls back to its floor estimates until the next successful emit.
  }
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
    initialPlanGatePolicy: params.planGatePolicy,
    onApprovalRequest: (request) => {
      emit(EVENT_SESSION_TOOL_APPROVAL_REQUESTED, request);
    },
  });
  const attachmentsController = createAttachmentsExtension({
    projectPath: params.projectPath,
    listProjectFiles: (cwd, limit) => listProjectFiles(cwd, limit),
  });
  // ask-user (its own plugin): registers the `ask_user_question` tool. The GUI frontend bridges
  // a pending question to the renderer as an event; the host later resolves it via answerQuestion.
  const askFrontend = createDeferredFrontend({
    onAskRequest: (request) => {
      emit(EVENT_SESSION_ASK_USER_REQUESTED, request);
    },
  });
  const askUserController = createAskUserExtension({ frontend: askFrontend });

  // `getCommands()` (extension commands + prompt templates + skills, pi's canonical list)
  // only exists on the ExtensionAPI handed to factories — capture it with a probe factory so
  // the bridge can serve the composer's `/` autocomplete without re-deriving the assembly.
  let extensionApi: ExtensionAPI | undefined;
  const commandsProbe: ExtensionFactory = (pi) => {
    extensionApi = pi;
  };

  const agentDir = getAgentDir();
  // MCP support is a pi extension, not built in: point pi at the bundled pi-mcp-adapter so it
  // reads `.pi/mcp.json` and bridges MCP servers into the agent's tools. Only when the project
  // actually configures servers (otherwise the extension's proxy tool is dead weight).
  const mcpAdapterPath = resolveMcpAdapterPath();
  const loadMcpAdapter = mcpAdapterPath ? await hasMcpServers(params.projectPath, agentDir) : false;
  const resourceLoader = new DefaultResourceLoader({
    cwd: params.projectPath,
    agentDir,
    settingsManager: SettingsManager.create(params.projectPath, agentDir),
    extensionFactories: [
      agentModeController.factory,
      attachmentsController.factory,
      askUserController.factory,
      commandsProbe,
    ],
    ...(loadMcpAdapter && mcpAdapterPath ? { additionalExtensionPaths: [mcpAdapterPath] } : {}),
  });

  await resourceLoader.reload();

  // Resume from a persisted session file when we have one — otherwise pi creates a brand
  // new session (with a fresh sessionId) on every rehydrate and the renderer's id goes
  // stale ("Unknown session" on the next call). When the file doesn't exist anymore (user
  // wiped pi's session dir, for instance) we fall back to a fresh session.
  let sessionManager: PiSessionManager | undefined;
  if (params.sessionFile) {
    try {
      sessionManager = PiSessionManager.open(params.sessionFile);
    } catch {
      sessionManager = undefined;
    }
  }

  const excludeTools =
    params.excludedTools && params.excludedTools.length > 0 ? params.excludedTools : undefined;

  const { session } = await createAgentSession({
    cwd: params.projectPath,
    authStorage,
    modelRegistry,
    resourceLoader,
    ...(sessionManager ? { sessionManager } : {}),
    ...(model ? { model } : {}),
    ...(thinkingLevel ? { thinkingLevel } : {}),
    ...(excludeTools ? { excludeTools } : {}),
  });

  agentModeController.setPlanFilePath(
    pathJoin(params.projectPath, ".pi-deck", "plans", `${session.sessionId}.md`),
  );

  const unsubscribe = session.subscribe((event: AgentSessionEvent) => {
    forwardEvent(event, emit, session);
  });

  // Fire the extension `session_start` lifecycle. pi only emits it from bindExtensions()/reload(),
  // so a headless host must call this itself — otherwise path-loaded extensions that initialize on
  // session_start (the MCP adapter) never run and their tools report "not initialized".
  try {
    await session.bindExtensions({});
  } catch (err) {
    emit("agent.event", {
      type: "prompt_error",
      message: `Extension startup failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Now that extensions are bound, pi has assembled the system prompt and registered every tool
  // (built-in + the MCP adapter's proxy/direct tools). Estimate that fixed overhead and push it to
  // the renderer so the Context tab / composer ring can attribute each slice of the window. Fires
  // on every (re)spawn, so toggling a server refreshes the figure.
  emitContextCost(session, mcpAdapterPath, emit);

  // Tell the agent-mode plugin which tool names are MCP-origin so `auto` mode can gate MCP
  // invocations (direct-exposed MCP tools have arbitrary names; the `mcp` proxy is matched by
  // name regardless). Best-effort: a failure here must never break session startup.
  try {
    const mcpToolNames = session
      .getAllTools()
      .filter((tool) => isMcpTool(tool, mcpAdapterPath))
      .map((tool) => tool.name);
    agentModeController.setMcpToolNames(mcpToolNames);
  } catch {
    // Non-fatal: auto mode still gates the `mcp` proxy by name and inspects bash/edit/write.
  }

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
    answerQuestion: (askId, answer) => {
      askFrontend.resolveAsk(askId, answer);
    },
    getHistory: () => buildHistorySnapshot(session),
    getForkPoints: () => {
      // Current-branch user messages in conversation order (root→leaf). Deliberately NOT
      // session.getUserMessagesForForking(), which scans the whole tree (getEntries) and would
      // include abandoned branches after a rewind — misaligning the renderer's ordinal mapping.
      const points: { entryId: string; text: string }[] = [];
      for (const entry of session.sessionManager.getBranch()) {
        if (entry.type !== "message") continue;
        const msg = entry.message as { role?: string; content?: unknown };
        if (msg.role !== "user") continue;
        points.push({ entryId: entry.id, text: extractUserText(msg.content) });
      }
      return points;
    },
    rewindTo: async (entryId: string) => {
      // pi moves the leaf to the target user message's parent and rebuilds agent.state.messages,
      // so a follow-up getHistory reflects the truncated branch. No summary of the abandoned path.
      const result = await session.navigateTree(entryId);
      return { editorText: result.editorText, leafId: session.sessionManager.getLeafId() };
    },
    applyLeaf: (leafId: string) => {
      // Durability: on open pi sets the leaf to the last physical line, so a rewind not yet
      // followed by a turn would snap back. Re-point the leaf and rebuild the working transcript.
      session.sessionManager.branch(leafId);
      session.agent.state.messages = session.sessionManager.buildSessionContext().messages;
    },
    forkAt: (entryId: string) => {
      const sm = session.sessionManager;
      const target = sm.getEntry(entryId);
      if (!target) throw new Error(`Entry ${entryId} not found`);
      // Mirror pi's runtime.fork: for a user message, branch BEFORE it (leaf = parent) and
      // return its text so the fork's composer is pre-filled to re-ask (possibly edited).
      let leafId: string | null = entryId;
      let editorText: string | undefined;
      if (target.type === "message") {
        const msg = target.message as { role?: string; content?: unknown };
        if (msg.role === "user") {
          leafId = target.parentId;
          editorText = extractUserText(msg.content);
        }
      }
      // Forking before the very first entry → no prior content; host creates a fresh session.
      if (!leafId) return { sessionFile: undefined, editorText };
      const file = session.sessionFile;
      if (!file) throw new Error("Session is not persisted; cannot fork");
      // Extract the branch through a detached SessionManager so the live session is untouched.
      const detached = PiSessionManager.open(file, sm.getSessionDir());
      const newFile = detached.createBranchedSession(leafId);
      return { sessionFile: newFile ?? undefined, editorText };
    },
    getCommands: () => {
      if (extensionApi) {
        return extensionApi.getCommands().map((c) => ({
          name: c.name,
          description: c.description,
          source: c.source,
          sourcePath: c.sourceInfo?.path,
        }));
      }
      // Probe factory hasn't run (defensive — reload() executes factories before the session
      // exists). The public surface still covers templates + skills, just not extension
      // commands.
      return [
        ...session.promptTemplates.map((t) => ({
          name: t.name,
          description: t.description,
          source: "prompt" as const,
          sourcePath: t.filePath,
        })),
        ...session.resourceLoader.getSkills().skills.map((s) => ({
          name: `skill:${s.name}`,
          description: s.description,
          source: "skill" as const,
          sourcePath: s.filePath,
        })),
      ];
    },
    dispose: () => {
      unsubscribe();
      agentModeController.dispose();
      askUserController.dispose();
      session.dispose();
    },
  };
}

/**
 * Walk pi's persisted session messages and reshape them into the renderer's
 * MessageEntry / ToolCallEntry vocabulary. Called once on activate so the chat view
 * can paint the prior conversation without waiting for a new turn.
 */
function buildHistorySnapshot(session: AgentSession): HistorySnapshot {
  const messages: HistoryMessage[] = [];
  const toolCalls: HistoryToolCall[] = [];
  // The agent state holds the resolved transcript pi will hand to the next LLM call —
  // identical to what was shown live in the previous run.
  const piMessages = (session.agent.state.messages ?? []) as unknown[];
  for (const raw of piMessages) {
    if (typeof raw !== "object" || raw === null) continue;
    const m = raw as {
      role?: string;
      content?: unknown;
      timestamp?: number;
      model?: string;
      toolCallId?: string;
      toolName?: string;
      isError?: boolean;
    };
    const ts = typeof m.timestamp === "number" ? m.timestamp : Date.now();
    if (m.role === "user") {
      messages.push({
        kind: "user",
        id: `u-hist-${ts}-${messages.length}`,
        text: extractUserText(m.content),
        createdAt: ts,
      });
      continue;
    }
    if (m.role === "assistant") {
      const blocks = Array.isArray(m.content) ? (m.content as unknown[]) : [];
      let text = "";
      const ids: string[] = [];
      for (const block of blocks) {
        if (typeof block !== "object" || block === null) continue;
        const b = block as {
          type?: string;
          text?: string;
          id?: string;
          name?: string;
          arguments?: unknown;
        };
        if (b.type === "text" && typeof b.text === "string") {
          text += b.text;
        } else if (b.type === "toolCall" && typeof b.id === "string") {
          ids.push(b.id);
          toolCalls.push({
            id: b.id,
            name: typeof b.name === "string" ? b.name : "",
            input: b.arguments,
            // A bare toolCall in history without a matching toolResult means the previous
            // run was killed mid-call; render it as cancelled rather than leaving it
            // perpetually "running" in the rebuilt UI.
            status: "cancelled",
            startedAt: ts,
          });
        }
      }
      messages.push({
        kind: "assistant",
        id: `a-hist-${ts}-${messages.length}`,
        text,
        isComplete: true,
        toolCallIds: ids,
        createdAt: ts,
        remoteTimestamp: ts,
        model: typeof m.model === "string" ? m.model : undefined,
      });
      continue;
    }
    if (m.role === "toolResult" && typeof m.toolCallId === "string") {
      const idx = toolCalls.findIndex((t) => t.id === m.toolCallId);
      if (idx === -1) continue;
      const existing = toolCalls[idx];
      if (!existing) continue;
      toolCalls[idx] = {
        ...existing,
        result: m.content,
        status: m.isError ? "error" : "done",
        endedAt: ts,
      };
    }
  }
  return { messages, toolCalls };
}

function forwardEvent(event: AgentSessionEvent, emit: EventEmitter, session: AgentSession): void {
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
