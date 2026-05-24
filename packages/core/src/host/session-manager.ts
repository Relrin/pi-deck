import { EventEmitter } from "node:events";
import { unlink } from "node:fs/promises";
import type { AgentMode, SessionModelRef, ThinkingLevel } from "../domain/session.js";
import type { ApprovalDecision } from "../extensions/agent-mode/index.js";
import { currentBranch } from "../git/branches.js";
import type { PromptAttachment, PromptImage } from "../protocol/commands.js";
import {
  EVENT_HOST_ERROR,
  EVENT_SESSION_AGENT_EVENT,
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
  /** Agent permission mode set on the composer; not enforced by the agent loop yet. */
  agentMode?: AgentMode;
  /** Git branch snapshot taken when the session was created. */
  branch?: string;
  /** True after the user archives. The session keeps its files; UI buckets it differently. */
  archived: boolean;
  worker?: WorkerHandle;
}

export interface SessionManagerOptions {
  spawnWorker: () => WorkerHandle;
  providerManager?: ProviderManager;
  metadataStore?: MetadataStore;
}

export type SessionManagerEvents = {
  event: [topic: EventTopic, payload: unknown];
};

const WORKER_TOPIC_MAP: Record<string, EventTopic> = {
  "message.delta": EVENT_SESSION_MESSAGE_DELTA,
  "user.message": EVENT_SESSION_USER_MESSAGE,
  "tool.call.start": EVENT_SESSION_TOOL_CALL_START,
  "tool.call.update": EVENT_SESSION_TOOL_CALL_UPDATE,
  "tool.call.end": EVENT_SESSION_TOOL_CALL_END,
  "turn.end": EVENT_SESSION_TURN_END,
  "agent.event": EVENT_SESSION_AGENT_EVENT,
  // The agent-mode plugin emits this topic verbatim from the worker; we expose it under the
  // canonical EventTopic name so renderer code subscribes via the same constant.
  [EVENT_SESSION_TOOL_APPROVAL_REQUESTED]: EVENT_SESSION_TOOL_APPROVAL_REQUESTED,
};

export class SessionManager extends EventEmitter<SessionManagerEvents> {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly spawnWorker: () => WorkerHandle;
  private readonly providerManager?: ProviderManager;
  private readonly metadataStore?: MetadataStore;
  private readonly rehydratedProjects = new Set<string>();
  private nextLocalId = 1;

  constructor(opts: SessionManagerOptions) {
    super();
    this.spawnWorker = opts.spawnWorker;
    this.providerManager = opts.providerManager;
    this.metadataStore = opts.metadataStore;
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
    const persisted = project.sessions ?? {};
    for (const id of project.sessionIds) {
      if (this.sessions.has(id)) continue;
      const meta = persisted[id];
      if (!meta) continue;
      this.sessions.set(id, {
        id,
        projectId,
        projectPath: project.path,
        title: meta.title,
        createdAt: meta.createdAt,
        lastActivityAt: meta.lastActivityAt,
        sessionFile: meta.sessionFile,
        branch: meta.branch,
        archived: meta.archived,
      });
    }
    this.rehydratedProjects.add(projectId);
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
      modelRef,
      thinkingLevel: input.thinkingLevel,
      agentMode: input.agentMode,
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
    record.lastActivityAt = new Date().toISOString();

    // Tell the renderer what was already in this session (empty for a brand-new one,
    // populated for a resumed one) so the chat view can repaint the prior conversation.
    try {
      const history = (await worker.request("getHistory", {})) as {
        messages: unknown[];
        toolCalls: unknown[];
      };
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

    const result = (await worker.request("prompt", { text, images: opts?.images })) as {
      promptId: string;
    };
    record.lastActivityAt = new Date().toISOString();
    void this.patchMetadata(record, { lastActivityAt: record.lastActivityAt });
    return result;
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

  async cancel(sessionId: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record?.worker?.isAlive) return;
    await record.worker.request("cancel", {});
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
