import { EventEmitter } from "node:events";
import {
  EVENT_HOST_ERROR,
  EVENT_SESSION_AGENT_EVENT,
  EVENT_SESSION_MESSAGE_DELTA,
  EVENT_SESSION_TOOL_CALL_END,
  EVENT_SESSION_TOOL_CALL_START,
  EVENT_SESSION_TOOL_CALL_UPDATE,
  EVENT_SESSION_TURN_END,
  EVENT_SESSION_WORKER_EXIT,
  type EventTopic,
} from "../protocol/events.js";
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
  worker?: WorkerHandle;
}

export interface SessionManagerOptions {
  spawnWorker: () => WorkerHandle;
}

export type SessionManagerEvents = {
  event: [topic: EventTopic, payload: unknown];
};

const WORKER_TOPIC_MAP: Record<string, EventTopic> = {
  "message.delta": EVENT_SESSION_MESSAGE_DELTA,
  "tool.call.start": EVENT_SESSION_TOOL_CALL_START,
  "tool.call.update": EVENT_SESSION_TOOL_CALL_UPDATE,
  "tool.call.end": EVENT_SESSION_TOOL_CALL_END,
  "turn.end": EVENT_SESSION_TURN_END,
  "agent.event": EVENT_SESSION_AGENT_EVENT,
};

export class SessionManager extends EventEmitter<SessionManagerEvents> {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly spawnWorker: () => WorkerHandle;
  private nextLocalId = 1;

  constructor(opts: SessionManagerOptions) {
    super();
    this.spawnWorker = opts.spawnWorker;
  }

  list(projectId: string): SessionRecord[] {
    return [...this.sessions.values()].filter((s) => s.projectId === projectId);
  }

  get(sessionId: string): SessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  async create(input: {
    projectId: string;
    projectPath: string;
    title?: string;
  }): Promise<SessionRecord> {
    const localId = `local-${this.nextLocalId++}`;
    const now = new Date().toISOString();
    const record: SessionRecord = {
      id: localId,
      projectId: input.projectId,
      projectPath: input.projectPath,
      title: input.title ?? "New session",
      createdAt: now,
      lastActivityAt: now,
    };
    this.sessions.set(localId, record);
    // Spawn immediately so pi can assign a real session id.
    await this.activate(localId);
    return record;
  }

  async activate(sessionId: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown session ${sessionId}`);
    if (record.worker?.isAlive) return;

    const worker = this.spawnWorker();
    record.worker = worker;
    this.bindWorker(record, worker);

    const init = (await worker.request("init", {
      projectPath: record.projectPath,
      sessionFile: record.sessionFile,
    })) as { sessionId: string; sessionFile: string };

    if (init.sessionId && init.sessionId !== record.id) {
      this.sessions.delete(record.id);
      record.id = init.sessionId;
      this.sessions.set(record.id, record);
    }
    record.sessionFile = init.sessionFile;
    record.lastActivityAt = new Date().toISOString();
  }

  async deactivate(sessionId: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record?.worker) return;
    record.worker.kill();
    record.worker = undefined;
  }

  async prompt(sessionId: string, text: string): Promise<{ promptId: string }> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown session ${sessionId}`);
    if (!record.worker?.isAlive) await this.activate(sessionId);
    const worker = record.worker;
    if (!worker) throw new Error("Worker not running");
    const result = (await worker.request("prompt", { text })) as { promptId: string };
    record.lastActivityAt = new Date().toISOString();
    return result;
  }

  async cancel(sessionId: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record?.worker?.isAlive) return;
    await record.worker.request("cancel", {});
  }

  shutdown(): void {
    for (const record of this.sessions.values()) {
      record.worker?.kill();
    }
    this.sessions.clear();
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
