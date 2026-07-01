import { EventEmitter } from "node:events";
import { unlink } from "node:fs/promises";
import {
  type SessionInfo as PiSessionInfo,
  SessionManager as PiSessionManager,
} from "@earendil-works/pi-coding-agent";
import type {
  AgentMode,
  PlanGatePolicy,
  SessionModelRef,
  ThinkingLevel,
} from "../domain/session.js";
import type { ApprovalDecision } from "../extensions/agent-mode/index.js";
import { currentBranch } from "../git/branches.js";
import type {
  AskUserAnswer,
  PromptAttachment,
  PromptImage,
  SessionCommandInfo,
} from "../protocol/commands.js";
import {
  EVENT_HOST_ERROR,
  EVENT_SESSION_AGENT_EVENT,
  EVENT_SESSION_ASK_USER_REQUESTED,
  EVENT_SESSION_CONTEXT_COST,
  EVENT_SESSION_HISTORY_LOADED,
  EVENT_SESSION_MESSAGE_DELTA,
  EVENT_SESSION_TOOL_APPROVAL_REQUESTED,
  EVENT_SESSION_TOOL_CALL_END,
  EVENT_SESSION_TOOL_CALL_START,
  EVENT_SESSION_TOOL_CALL_UPDATE,
  EVENT_SESSION_TURN_END,
  EVENT_SESSION_USER_MESSAGE,
  EVENT_SESSION_WORKER_EXIT,
  type EventTopic,
} from "../protocol/events.js";
import type { MetadataStore } from "./metadata-store.js";
import type { ProviderManager } from "./provider-manager.js";
import type { WorkerHandle } from "./worker-handle.js";

export interface SessionRecord {
  id: string;
  projectId: string;
  projectPath: string;
  title: string;
  createdAt: string;
  lastActivityAt: string;
  /** Pi session file path; set after worker init reports it. */
  sessionFile?: string;
  /** Structured model selection, persisted via ProviderManager. */
  modelRef?: SessionModelRef;
  thinkingLevel?: ThinkingLevel;
  /** Agent permission mode set on the composer. */
  agentMode?: AgentMode;
  /** Plan-mode policy for non-read-only operations, captured at creation. */
  planGatePolicy?: PlanGatePolicy;
  /** Tool ids disabled for this session. */
  excludedTools?: string[];
  /** Git branch snapshot taken when the session was created. */
  branch?: string;
  /** True after the user archives. The session keeps its files; UI buckets it differently. */
  archived: boolean;
  /**
   * Count of user messages present when the current worker last loaded history. Anchors the
   * ordinal - turnSeq mapping a rewind uses to scope its code revert. Set on every `activate`.
   */
  historyUserCount?: number;
  /**
   * Leaf id pi's tree was rewound to but not yet persisted by a fresh turn. Re-applied after a
   * worker respawn so a bounce can't silently undo the rewind; cleared once the next prompt
   * appends onto the branch. See the "Rewind durability" note in the plan.
   */
  rewindLeafId?: string;
  worker?: WorkerHandle;
}

export interface SessionManagerOptions {
  spawnWorker: () => WorkerHandle;
  providerManager?: ProviderManager;
  metadataStore?: MetadataStore;
  listPiSessions?: (cwd: string) => Promise<PiSessionInfo[]>;
}

export type SessionManagerEvents = {
  event: [topic: EventTopic, payload: unknown];
};

/**
 * Hook the turn tracker installs via `setTurnLifecycle` so `prompt()` can take the
 * turn-start `git stash create` snapshot before forwarding the prompt to the worker.
 * Kept as a setter (not a constructor dep) to avoid a circular dep between
 * SessionManager and TurnTracker — TurnTracker subscribes to SessionManager's events.
 */
export interface TurnLifecycle {
  beginTurn: (sessionId: string, projectId: string, repoRoot: string) => Promise<string>;
  /**
   * Hard-revert the working tree for a rewind: discard every recorded turn at or after
   * `fromTurnSeq` and realign the turn counter. Optional so lightweight test doubles that only
   * provide `beginTurn` keep working — `rewindTo` skips the code revert when it's absent.
   */
  rewindRevert?: (sessionId: string, fromTurnSeq: number) => Promise<void>;
}

const WORKER_TOPIC_MAP: Record<string, EventTopic> = {
  "message.delta": EVENT_SESSION_MESSAGE_DELTA,
  "user.message": EVENT_SESSION_USER_MESSAGE,
  "tool.call.start": EVENT_SESSION_TOOL_CALL_START,
  "tool.call.update": EVENT_SESSION_TOOL_CALL_UPDATE,
  "tool.call.end": EVENT_SESSION_TOOL_CALL_END,
  "turn.end": EVENT_SESSION_TURN_END,
  "session.context.cost": EVENT_SESSION_CONTEXT_COST,
  "agent.event": EVENT_SESSION_AGENT_EVENT,
  // The agent-mode plugin emits this topic verbatim from the worker; we expose it under the
  // canonical EventTopic name so renderer code subscribes via the same constant.
  [EVENT_SESSION_TOOL_APPROVAL_REQUESTED]: EVENT_SESSION_TOOL_APPROVAL_REQUESTED,
  // Likewise the ask-user plugin emits this verbatim when the model calls `ask_user_question`.
  [EVENT_SESSION_ASK_USER_REQUESTED]: EVENT_SESSION_ASK_USER_REQUESTED,
};

/**
 * How long a graceful cancel may take before the worker is presumed wedged and gets
 * force-killed. Normal aborts resolve in well under a second; the generous window only
 * matters when a tool subprocess needs a moment to die.
 */
const CANCEL_GRACE_MS = 10_000;

export class SessionManager extends EventEmitter<SessionManagerEvents> {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly spawnWorker: () => WorkerHandle;
  private readonly providerManager?: ProviderManager;
  private readonly metadataStore?: MetadataStore;
  private readonly listPiSessions: (cwd: string) => Promise<PiSessionInfo[]>;
  private readonly rehydratedProjects = new Set<string>();
  private turnLifecycle: TurnLifecycle | null = null;
  private nextLocalId = 1;

  constructor(opts: SessionManagerOptions) {
    super();
    this.spawnWorker = opts.spawnWorker;
    this.providerManager = opts.providerManager;
    this.metadataStore = opts.metadataStore;
    this.listPiSessions = opts.listPiSessions ?? ((cwd) => PiSessionManager.list(cwd));
  }

  /**
   * Install the turn-tracker hook called from `prompt()` before each prompt is forwarded
   * to the worker. Setting it twice replaces the previous hook (the host wires this once
   * at startup; tests can rebind).
   */
  setTurnLifecycle(lifecycle: TurnLifecycle | null): void {
    this.turnLifecycle = lifecycle;
  }

  list(projectId: string): SessionRecord[] {
    return [...this.sessions.values()].filter((s) => s.projectId === projectId);
  }

  listArchived(): SessionRecord[] {
    return [...this.sessions.values()].filter((s) => s.archived);
  }

  get(sessionId: string): SessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Build stub `SessionRecord`s from persisted metadata for any sessions belonging to
   * `projectId` that aren't already in memory. No-op after the first call per project.
   * Workers are NOT spawned — that happens lazily on `activate`.
   */
  async rehydrateProject(projectId: string): Promise<void> {
    if (this.rehydratedProjects.has(projectId)) return;
    if (!this.metadataStore) {
      this.rehydratedProjects.add(projectId);
      return;
    }

    const project = await this.metadataStore.readProject(projectId);
    if (!project) {
      this.rehydratedProjects.add(projectId);
      return;
    }

    const projectBranch = await this.resolveCurrentBranch(project.path);
    const persisted = project.sessions ?? {};
    for (const id of project.sessionIds) {
      if (this.sessions.has(id)) continue;
      const meta = persisted[id];
      if (!meta) continue;

      const branch = meta.branch ?? projectBranch;
      this.sessions.set(id, {
        id,
        projectId,
        projectPath: project.path,
        title: meta.title,
        createdAt: meta.createdAt,
        lastActivityAt: meta.lastActivityAt,
        sessionFile: meta.sessionFile,
        agentMode: meta.agentMode,
        excludedTools: meta.excludedTools,
        branch,
        archived: meta.archived,
      });

      // Backfill on disk so subsequent rehydrates short-circuit
      if (!meta.branch && projectBranch) {
        try {
          await this.metadataStore.patchSession(projectId, id, { branch: projectBranch });
        } catch {
          // ignore
        }
      }
    }
    // Then look for sessions pi has stamped for this project's cwd (typically created via
    // the `pi` CLI in a terminal) that pi-deck hasn't claimed yet. Adopt them so the rail
    // shows them alongside sessions we created ourselves.
    await this.discoverPiSessions(projectId, project.path, projectBranch);
    this.rehydratedProjects.add(projectId);
  }

  /**
   * Read the project's current git branch, swallowing any error (not a repo, git missing,
   * deleted directory). Centralised so both the rehydrate path and the discover path can
   * share one git call per project.
   */
  private async resolveCurrentBranch(projectPath: string): Promise<string | undefined> {
    try {
      const b = await currentBranch(projectPath);
      return b || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Walk pi's session directory for the given cwd and merge any sessions we don't already
   * know about into both the in-memory map AND pi-deck's persisted metadata. Subsequent
   * launches treat them like any other session (rename, archive, delete all work).
   *
   * pi's `id` is the canonical key — pi-deck stamps the same id on its own sessions after
   * the worker reports it (see `activate` below), so by the time we get here we can dedupe
   * cleanly via `this.sessions.has(id)`. Non-fatal on any error so a missing or unreadable
   * pi session dir can't bring down project rehydration.
   */
  private async discoverPiSessions(
    projectId: string,
    projectPath: string,
    projectBranch: string | undefined,
  ): Promise<void> {
    let infos: PiSessionInfo[];
    try {
      infos = await this.listPiSessions(projectPath);
    } catch {
      return;
    }
    // For sessions created in a terminal `pi` run we no longer know which branch was
    // checked out at the time. The caller passes the project's *current* branch, which we
    // stamp onto the adopted record — better than a blank line, and consistent with
    // pi-deck's own create flow which also snapshots the branch via `currentBranch`.
    for (const info of infos) {
      if (this.sessions.has(info.id)) continue;
      const createdAt = info.created.toISOString();
      const lastActivityAt = info.modified.toISOString();
      const title = derivePiSessionTitle(info);
      const record: SessionRecord = {
        id: info.id,
        projectId,
        projectPath,
        title,
        createdAt,
        lastActivityAt,
        sessionFile: info.path,
        branch: projectBranch,
        archived: false,
      };
      this.sessions.set(info.id, record);
      if (this.metadataStore) {
        try {
          await this.metadataStore.upsertSession(projectId, {
            id: info.id,
            title,
            createdAt,
            lastActivityAt,
            sessionFile: info.path,
            branch: projectBranch,
            archived: false,
          });
        } catch {
          // Persistence is best-effort; the in-memory record still surfaces in the rail.
        }
      }
    }
  }

  /** Rehydrate every known project so `listArchived()` returns a complete view. */
  async rehydrateAll(): Promise<void> {
    if (!this.metadataStore) return;
    const projects = await this.metadataStore.listProjects();
    for (const p of projects) {
      await this.rehydrateProject(p.id);
    }
  }

  async create(input: {
    projectId: string;
    projectPath: string;
    title?: string;
    modelRef?: SessionModelRef;
    thinkingLevel?: ThinkingLevel;
    agentMode?: AgentMode;
    planGatePolicy?: PlanGatePolicy;
    excludedTools?: string[];
    /**
     * Resume from an existing pi session file instead of creating a fresh one. Used by
     * `forkFrom` to point the new session at the branched JSONL — `activate` opens it exactly
     * like the resume path.
     */
    sessionFile?: string;
  }): Promise<SessionRecord> {
    const localId = `local-${this.nextLocalId++}`;
    const now = new Date().toISOString();
    // If the caller didn't pin a model, inherit the user's last choice (recent default).
    const fallback = this.providerManager?.registry.getDefaultModel();
    const modelRef = input.modelRef ?? fallback;
    const record: SessionRecord = {
      id: localId,
      projectId: input.projectId,
      projectPath: input.projectPath,
      title: input.title ?? "New session",
      createdAt: now,
      lastActivityAt: now,
      sessionFile: input.sessionFile,
      modelRef,
      thinkingLevel: input.thinkingLevel,
      agentMode: input.agentMode,
      planGatePolicy: input.planGatePolicy,
      excludedTools: input.excludedTools,
      archived: false,
    };
    this.sessions.set(localId, record);
    // Spawn immediately so pi can assign a real session id.
    await this.activate(localId);
    if (modelRef && this.providerManager) {
      // Persist the per-session pin so a restart restores it.
      await this.providerManager.setSessionSelection(record.id, modelRef, input.thinkingLevel);
    }
    // Snapshot the branch once at creation; absent when the project isn't a git repo.
    try {
      const branch = await currentBranch(input.projectPath);
      record.branch = branch || undefined;
    } catch {
      // Not a git repo or git unavailable — leave branch undefined.
    }
    await this.persistMetadata(record);
    return record;
  }

  async activate(sessionId: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown session ${sessionId}`);
    if (record.worker?.isAlive) return;

    // Hydrate the model selection from the providers store if it was persisted across runs.
    if (!record.modelRef && this.providerManager) {
      const saved = this.providerManager.getSessionSelection(sessionId);
      if (saved) {
        record.modelRef = saved.modelRef;
        record.thinkingLevel = saved.thinkingLevel;
      }
    }

    const worker = this.spawnWorker();
    record.worker = worker;
    this.bindWorker(record, worker);

    const init = (await worker.request("init", {
      projectPath: record.projectPath,
      sessionFile: record.sessionFile,
      modelRef: record.modelRef,
      thinkingLevel: record.thinkingLevel,
      agentMode: record.agentMode,
      planGatePolicy: record.planGatePolicy,
      excludedTools: record.excludedTools,
    })) as { sessionId: string; sessionFile: string };

    if (init.sessionId && init.sessionId !== record.id) {
      const oldId = record.id;
      this.sessions.delete(oldId);
      record.id = init.sessionId;
      this.sessions.set(record.id, record);
      // Mirror the id swap into persisted metadata so the project's sessionIds stays in sync.
      if (this.metadataStore) {
        try {
          await this.metadataStore.renameSessionId(record.projectId, oldId, record.id);
        } catch {
          // Non-fatal — metadata will self-heal on the next upsertSession.
        }
      }
    }
    record.sessionFile = init.sessionFile;
    // Intentionally do NOT bump lastActivityAt here. Opening an old session shouldn't move
    // its row to the top of the rail — only sending a new prompt counts as activity. The
    // bump lives in `prompt()` below.

    // Re-apply a pending rewind before reading history: on open pi points the leaf at the last
    // physical entry, so without this a worker respawn would silently undo an un-committed rewind.
    if (record.rewindLeafId) {
      try {
        await worker.request("applyLeaf", { leafId: record.rewindLeafId });
      } catch {
        // Non-fatal — worst case the conversation reverts to full history until the next prompt.
      }
    }

    // Tell the renderer what was already in this session (empty for a brand-new one,
    // populated for a resumed one) so the chat view can repaint the prior conversation.
    await this.pushHistory(record, worker, true);
  }

  /**
   * Fetch the worker's history snapshot and emit it to the renderer. When `anchorUserCount` is
   * set (on activate) it also records how many user messages the worker started with — the
   * fixed `H` a rewind uses to map a user-message ordinal onto a turn counter. Rewinds re-emit
   * with `anchorUserCount = false` so `H` stays pinned to the worker-start value. Best-effort.
   */
  private async pushHistory(
    record: SessionRecord,
    worker: WorkerHandle,
    anchorUserCount: boolean,
  ): Promise<void> {
    try {
      const history = (await worker.request("getHistory", {})) as {
        messages: { kind?: string }[];
        toolCalls: unknown[];
      };
      if (anchorUserCount) {
        record.historyUserCount = history.messages.filter((m) => m?.kind === "user").length;
      }
      this.emit("event", EVENT_SESSION_HISTORY_LOADED, {
        sessionId: record.id,
        messages: history.messages,
        toolCalls: history.toolCalls,
      });
    } catch {
      // Non-fatal — the renderer's empty state still works; user can prompt as normal.
    }
  }

  async deactivate(sessionId: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record?.worker) return;
    record.worker.kill();
    record.worker = undefined;
  }

  async prompt(
    sessionId: string,
    text: string,
    opts?: {
      agentMode?: AgentMode;
      attachments?: PromptAttachment[];
      images?: PromptImage[];
    },
  ): Promise<{ promptId: string }> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown session ${sessionId}`);
    if (!record.worker?.isAlive) await this.activate(sessionId);
    const worker = record.worker;
    if (!worker) throw new Error("Worker not running");

    if (opts?.agentMode && opts.agentMode !== record.agentMode) {
      record.agentMode = opts.agentMode;
      await worker.request("setAgentMode", { mode: opts.agentMode });
      void this.patchMetadata(record, { agentMode: opts.agentMode });
    }

    if (opts?.attachments) {
      await worker.request("setPendingAttachments", { attachments: opts.attachments });
      // Auto-include the user's attached folders in the edit allowlist so `accept-edits` mode
      // can act on them without prompting. The worker already starts with the project root in
      // its allowlist (set up in agent-bridge.initBridge), so we extend rather than replace.
      const folderRoots = opts.attachments.filter((a) => a.kind === "folder").map((a) => a.path);
      if (folderRoots.length > 0) {
        await worker.request("setEditAllowlist", {
          paths: [record.projectPath, ...folderRoots],
        });
      }
    }

    // Snapshot the working tree before the agent starts writing. Done here (not inside the
    // worker) so the SHA is owned by the host's review store and survives worker exits.
    if (this.turnLifecycle) {
      try {
        await this.turnLifecycle.beginTurn(sessionId, record.projectId, record.projectPath);
      } catch {
        // Snapshot is best-effort — see TurnTracker.beginTurn comments.
      }
    }

    const result = (await worker.request("prompt", { text, images: opts?.images })) as {
      promptId: string;
    };
    // This turn appends onto the (possibly rewound) branch, persisting it — the leaf no longer
    // needs re-applying after a respawn.
    record.rewindLeafId = undefined;
    record.lastActivityAt = new Date().toISOString();
    void this.patchMetadata(record, { lastActivityAt: record.lastActivityAt });
    return result;
  }

  /** List the user-message anchor points the renderer maps bubbles to for rewind/fork. */
  async getForkPoints(sessionId: string): Promise<{ points: { entryId: string; text: string }[] }> {
    const worker = await this.ensureWorker(sessionId);
    return (await worker.request("getForkPoints", {})) as {
      points: { entryId: string; text: string }[];
    };
  }

  /**
   * Rewind the conversation to before the selected user message and hard-revert the working tree
   * for the discarded turns. `entryId` drives pi's tree move; `userMessageIndex` (0-based, among
   * user bubbles) scopes the code revert against the worker-start user count. Returns the rewound
   * message text so the renderer can pre-fill the composer.
   */
  async rewindTo(
    sessionId: string,
    entryId: string,
    userMessageIndex: number,
  ): Promise<{ editorText?: string }> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown session ${sessionId}`);
    const worker = await this.ensureWorker(sessionId);

    // 1. Conversation: pi moves the leaf before the target and rebuilds the working transcript.
    const res = (await worker.request("rewindTo", { entryId })) as {
      editorText?: string;
      leafId: string | null;
    };

    // 2. Code (hard revert, best-effort): discard every turn at or after the target. Only turns
    // snapshotted in the current worker session are revertable.
    if (this.turnLifecycle?.rewindRevert) {
      const historyUserCount = record.historyUserCount ?? 0;
      const fromTurnSeq = Math.max(1, userMessageIndex - historyUserCount + 1);
      try {
        await this.turnLifecycle.rewindRevert(sessionId, fromTurnSeq);
      } catch {
        // The conversation rewind already succeeded; a revert failure must not abort it.
      }
    }

    // 3. Remember the leaf so a respawn re-applies the rewind until the next prompt persists it.
    record.rewindLeafId = res.leafId ?? undefined;

    // 4. Repaint the truncated transcript (without moving the ordinal anchor H).
    await this.pushHistory(record, worker, false);
    return { editorText: res.editorText };
  }

  /**
   * Fork the session into a new parallel session branched before the selected user message. The
   * original thread is untouched (fork writes a brand-new file). Returns the new record and the
   * selected message text so the renderer can switch to it and pre-fill the composer.
   */
  async forkFrom(
    sessionId: string,
    entryId: string,
  ): Promise<{ record: SessionRecord; editorText?: string }> {
    const source = this.sessions.get(sessionId);
    if (!source) throw new Error(`Unknown session ${sessionId}`);
    const worker = await this.ensureWorker(sessionId);

    const forked = (await worker.request("forkAt", { entryId })) as {
      sessionFile?: string;
      editorText?: string;
    };
    const record = await this.create({
      projectId: source.projectId,
      projectPath: source.projectPath,
      title: `Fork of ${source.title}`,
      modelRef: source.modelRef,
      thinkingLevel: source.thinkingLevel,
      agentMode: source.agentMode,
      planGatePolicy: source.planGatePolicy,
      excludedTools: source.excludedTools,
      sessionFile: forked.sessionFile,
    });
    return { record, editorText: forked.editorText };
  }

  /** Ensure the session's worker is running and return it, activating on demand. */
  private async ensureWorker(sessionId: string): Promise<WorkerHandle> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown session ${sessionId}`);
    if (!record.worker?.isAlive) await this.activate(sessionId);
    const worker = record.worker;
    if (!worker) throw new Error("Worker not running");
    return worker;
  }

  /**
   * Set the session's permission mode without sending a prompt. Persists onto the record
   * (and metadata) so a restart restores it, and forwards to the live worker when one is
   * running. Idempotent — setting the same mode is a no-op besides the metadata touch.
   *
   * Intentionally does NOT auto-activate the worker. If the session is dormant, the new
   * mode rides along on the next `activate` via init params (see `record.agentMode`).
   */
  async setAgentMode(sessionId: string, mode: AgentMode): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown session ${sessionId}`);
    if (record.agentMode === mode) return;
    record.agentMode = mode;
    if (record.worker?.isAlive) {
      await record.worker.request("setAgentMode", { mode });
    }
    await this.patchMetadata(record, { agentMode: mode });
  }

  /**
   * Approve the current plan: flip the session into an executing mode and immediately send
   * a continuation prompt. The continuation becomes a real user turn in the transcript so
   * the transition is visible — no hidden state. Returns the auto-generated promptId so the
   * renderer can correlate the resulting events.
   */
  async approvePlan(
    sessionId: string,
    targetMode: Extract<AgentMode, "ask" | "accept-edits" | "auto">,
    continuationText?: string,
  ): Promise<{ promptId: string }> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown session ${sessionId}`);
    await this.setAgentMode(sessionId, targetMode);
    const text =
      continuationText?.trim() ||
      "The plan above is approved - proceed with execution. As you work, edit the plan file to " +
        "update each step's checkbox (`[ ]`→`[~]`→`[x]`) to show the progress.";
    return this.prompt(sessionId, text, { agentMode: targetMode });
  }

  /** Resolve a pending tool-call approval requested by the agent-mode plugin. */
  async resolveApproval(
    sessionId: string,
    approvalId: string,
    decision: ApprovalDecision,
    reason?: string,
  ): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown session ${sessionId}`);
    if (!record.worker?.isAlive) {
      // A dead worker can't act on the approval; the renderer treats a stale pill as resolved.
      return;
    }
    await record.worker.request("resolveApproval", { approvalId, decision, reason });
  }

  /** Resume a suspended `ask_user_question` tool call with the user's answer. */
  async answerQuestion(sessionId: string, askId: string, answer: AskUserAnswer): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown session ${sessionId}`);
    if (!record.worker?.isAlive) {
      return;
    }
    await record.worker.request("answerQuestion", { askId, answer });
  }

  async cancel(sessionId: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record?.worker?.isAlive) return;
    try {
      await record.worker.request("cancel", {}, CANCEL_GRACE_MS);
    } catch {
      // pi's `session.abort()` waits for the agent to go idle; a provider stream or tool
      // that ignores the abort signal leaves it (and this RPC) hanging forever. After the
      // grace period assume the worker is wedged and escalate to a hard kill — the session
      // file survives, so the next prompt respawns a fresh worker with full history.
      this.forceStop(sessionId, "Agent did not respond to stop — session was force-stopped.");
    }
  }

  /**
   * Hard-stop a session by killing its worker process tree. Used when a graceful cancel
   * times out, or directly by the renderer's "Force stop" escalation. The worker-exit
   * handler takes care of the rest: it emits `EVENT_SESSION_WORKER_EXIT` (which resets the
   * renderer's in-flight state) and clears `record.worker`.
   */
  forceStop(sessionId: string, notice?: string): void {
    const record = this.sessions.get(sessionId);
    if (!record?.worker?.isAlive) return;
    record.worker.kill("SIGKILL");
    if (notice) {
      this.emit("event", EVENT_HOST_ERROR, { message: notice, sessionId });
    }
  }

  /**
   * Slash commands the session's agent recognizes (extension commands, prompt templates,
   * skills). Spawns the worker on demand like `prompt()` — the list lives in the worker's
   * resource loader, which is only materialized inside a live pi session.
   */
  async commands(sessionId: string): Promise<{ commands: SessionCommandInfo[] }> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown session ${sessionId}`);
    if (!record.worker?.isAlive) await this.activate(sessionId);
    const worker = record.worker;
    if (!worker) throw new Error("Worker not running");
    return (await worker.request("commands", {})) as { commands: SessionCommandInfo[] };
  }

  /** Mid-session model switch. Forwarded to the live worker if there is one. */
  async setModel(
    sessionId: string,
    modelRef: SessionModelRef,
    thinkingLevel?: ThinkingLevel,
  ): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown session ${sessionId}`);
    record.modelRef = modelRef;
    if (thinkingLevel !== undefined) record.thinkingLevel = thinkingLevel;
    if (this.providerManager) {
      await this.providerManager.setSessionSelection(sessionId, modelRef, record.thinkingLevel);
    }
    if (record.worker?.isAlive) {
      await record.worker.request("setModel", { modelRef, thinkingLevel: record.thinkingLevel });
    }
    record.lastActivityAt = new Date().toISOString();
    void this.patchMetadata(record, { lastActivityAt: record.lastActivityAt });
  }

  /**
   * Replace the session's excluded-tools list. pi 0.77's SDK accepts `excludeTools` only at
   * `createAgentSession` time, so when the value changes on a live worker we deactivate +
   * reactivate it; the next `activate` re-runs `init` with the new list. The transcript
   * survives the bounce via `EVENT_SESSION_HISTORY_LOADED`.
   */
  async setExcludedTools(sessionId: string, excludedTools: string[]): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown session ${sessionId}`);
    const next = normalizeExcludedTools(excludedTools);
    if (sameExcludedTools(record.excludedTools, next)) return;
    record.excludedTools = next;
    await this.patchMetadata(record, { excludedTools: next });
    if (record.worker?.isAlive) {
      await this.deactivate(sessionId);
      await this.activate(sessionId);
    }
  }

  async setThinkingLevel(sessionId: string, level: ThinkingLevel): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown session ${sessionId}`);
    record.thinkingLevel = level;
    if (this.providerManager && record.modelRef) {
      await this.providerManager.setSessionSelection(sessionId, record.modelRef, level);
    }
    if (record.worker?.isAlive) {
      await record.worker.request("setThinkingLevel", { level });
    }
  }

  async rename(sessionId: string, title: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown session ${sessionId}`);
    const trimmed = title.trim();
    if (!trimmed) throw new Error("Session title cannot be empty");
    if (record.title === trimmed) return;
    record.title = trimmed;
    await this.patchMetadata(record, { title: trimmed });
  }

  async archive(sessionId: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown session ${sessionId}`);
    if (record.archived) return;
    record.archived = true;
    await this.patchMetadata(record, { archived: true });
  }

  async unarchive(sessionId: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown session ${sessionId}`);
    if (!record.archived) return;
    record.archived = false;
    await this.patchMetadata(record, { archived: false });
  }

  /**
   * Permanent delete: stop the worker, drop pi's session file from disk, remove from
   * in-memory + persisted metadata. Idempotent — deleting an unknown id is a no-op.
   */
  async delete(sessionId: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) return;
    if (record.worker?.isAlive) {
      record.worker.kill();
      record.worker = undefined;
    }
    const sessionFile = record.sessionFile;
    this.sessions.delete(sessionId);
    if (this.metadataStore) {
      try {
        await this.metadataStore.deleteSession(record.projectId, sessionId);
      } catch {
        // Non-fatal — the in-memory row is already gone.
      }
    }
    if (sessionFile) {
      try {
        await unlink(sessionFile);
      } catch {
        // The file may already be gone, or never persisted by pi. Either way: don't fail
        // the user-visible delete because of a cleanup hiccup.
      }
    }
  }

  shutdown(): void {
    for (const record of this.sessions.values()) {
      record.worker?.kill();
    }
    this.sessions.clear();
  }

  private async persistMetadata(record: SessionRecord): Promise<void> {
    if (!this.metadataStore) return;
    try {
      await this.metadataStore.upsertSession(record.projectId, {
        id: record.id,
        title: record.title,
        createdAt: record.createdAt,
        lastActivityAt: record.lastActivityAt,
        archived: record.archived,
        branch: record.branch,
        sessionFile: record.sessionFile,
        agentMode: record.agentMode,
        excludedTools: record.excludedTools,
      });
    } catch {
      // Persistence is best-effort; an i/o hiccup must not break the live session.
    }
  }

  private async patchMetadata(
    record: SessionRecord,
    patch: Partial<{
      title: string;
      lastActivityAt: string;
      archived: boolean;
      branch: string | undefined;
      sessionFile: string | undefined;
      agentMode: AgentMode | undefined;
      excludedTools: string[] | undefined;
    }>,
  ): Promise<void> {
    if (!this.metadataStore) return;
    try {
      await this.metadataStore.patchSession(record.projectId, record.id, patch);
    } catch {
      // Best-effort; see persistMetadata.
    }
  }

  private bindWorker(record: SessionRecord, worker: WorkerHandle): void {
    worker.on("event", (topic: string, payload: unknown) => {
      const mapped = WORKER_TOPIC_MAP[topic];
      if (!mapped) return;
      const tagged = {
        ...(typeof payload === "object" && payload !== null ? payload : {}),
        sessionId: record.id,
      };
      this.emit("event", mapped, tagged);
    });

    worker.on("error", (err: Error) => {
      this.emit("event", EVENT_HOST_ERROR, {
        message: err.message,
        sessionId: record.id,
      });
    });

    worker.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      this.emit("event", EVENT_SESSION_WORKER_EXIT, {
        sessionId: record.id,
        code,
        signal: signal ?? null,
      });
      if (record.worker === worker) {
        record.worker = undefined;
      }
    });
  }
}

/**
 * Trim + dedupe an excluded-tools list. Stored undefined when empty so a never-used field
 * doesn't show up in persisted metadata.
 */
function normalizeExcludedTools(input: string[]): string[] | undefined {
  const seen = new Set<string>();
  for (const raw of input) {
    const name = raw.trim();
    if (name) seen.add(name);
  }
  return seen.size === 0 ? undefined : [...seen].sort();
}

function sameExcludedTools(a: string[] | undefined, b: string[] | undefined): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
  return true;
}

const PI_SESSION_TITLE_MAX = 60;

/**
 * Pick a sensible display title for a session pi-deck discovered (i.e. it wasn't created
 * via pi-deck so we don't have a user-typed title). Preference order:
 *
 *   1. pi's stored display name (set via `/name` or `session_info` entries)
 *   2. the first user message, trimmed to a one-line preview
 *   3. a generic "Untitled session" so the rail never shows a blank row
 *
 * The first-message fallback collapses whitespace and truncates to a fixed width so a
 * paragraph-long opening prompt doesn't blow out the rail.
 */
function derivePiSessionTitle(info: PiSessionInfo): string {
  if (info.name?.trim()) return info.name.trim();
  const first = (info.firstMessage ?? "").replace(/\s+/g, " ").trim();
  if (first) {
    return first.length > PI_SESSION_TITLE_MAX
      ? `${first.slice(0, PI_SESSION_TITLE_MAX - 1).trimEnd()}…`
      : first;
  }
  return "Untitled session";
}
