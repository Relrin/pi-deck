import { EventEmitter } from "node:events";
import {
  EVENT_GIT_TURN_TOUCHES_CHANGED,
  EVENT_SESSION_TOOL_CALL_END,
  EVENT_SESSION_WORKER_EXIT,
  type EventTopic,
} from "../protocol/events.js";
import type { SessionManager } from "./session-manager.js";

interface SessionTouchState {
  paths: Set<string>;
  turnSeq: number;
}

export type TurnTrackerEvents = {
  event: [topic: EventTopic, payload: unknown];
};

/**
 * Built-in tool names that mutate a file on disk. The list mirrors the renderers in
 * `packages/ui/src/features/chat/tools/renderers/` plus a few aliases pi extensions are
 * likely to use. Adding extra names here is safe — unknown tools simply don't get tracked.
 */
const FILE_MUTATING_TOOLS = new Set([
  "write",
  "edit",
  "create",
  "create_file",
  "patch",
  "apply_patch",
  "file_write",
  "file_edit",
]);

/**
 * Tracks which files each session has written / edited so the git sidebar can badge them.
 * In-memory and ephemeral by design — the badge is a session-lifetime hint, not persisted
 * state. Listens on `SessionManager`'s `tool.call.end` events and broadcasts a
 * `git.turnTouches.changed` event whenever a new path joins a session's set.
 */
export class TurnTracker extends EventEmitter<TurnTrackerEvents> {
  private readonly state = new Map<string, SessionTouchState>();

  constructor(sessionManager: SessionManager) {
    super();
    sessionManager.on("event", (topic, payload) => {
      if (topic === EVENT_SESSION_TOOL_CALL_END) {
        this.handleToolEnd(payload);
      } else if (topic === EVENT_SESSION_WORKER_EXIT) {
        this.handleWorkerExit(payload);
      }
    });
  }

  getFor(sessionId: string): { paths: string[]; turnSeq: number } {
    const entry = this.state.get(sessionId);
    return entry ? { paths: [...entry.paths], turnSeq: entry.turnSeq } : { paths: [], turnSeq: 0 };
  }

  forget(sessionId: string): void {
    this.state.delete(sessionId);
  }

  private handleToolEnd(payload: unknown): void {
    const p = payload as {
      sessionId?: string;
      name?: string;
      input?: unknown;
      isError?: boolean;
    };
    if (!p?.sessionId || !p.name) return;
    if (p.isError) return;
    if (!FILE_MUTATING_TOOLS.has(p.name)) return;
    const filePath = extractFilePath(p.input);
    if (!filePath) return;

    const entry = this.state.get(p.sessionId) ?? {
      paths: new Set<string>(),
      turnSeq: 0,
    };
    const sizeBefore = entry.paths.size;
    entry.paths.add(filePath);
    if (entry.paths.size === sizeBefore) return; // No-op: path already tracked
    this.state.set(p.sessionId, entry);
    this.emit("event", EVENT_GIT_TURN_TOUCHES_CHANGED, {
      sessionId: p.sessionId,
      paths: [...entry.paths],
      turnSeq: entry.turnSeq,
    });
  }

  private handleWorkerExit(payload: unknown): void {
    const p = payload as { sessionId?: string };
    if (!p?.sessionId) return;
    this.state.delete(p.sessionId);
  }
}

function extractFilePath(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  for (const key of ["path", "file_path", "filename", "filepath"]) {
    const value = obj[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}
