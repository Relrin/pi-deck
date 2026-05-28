import { EventEmitter } from "node:events";
import { stat } from "node:fs/promises";
import {
  EVENT_SESSION_ARTEFACTS_CHANGED,
  EVENT_SESSION_TOOL_CALL_END,
  EVENT_SESSION_TOOL_CALL_START,
  EVENT_SESSION_WORKER_EXIT,
  type EventTopic,
} from "../protocol/events.js";
import type { SessionManager } from "./session-manager.js";

/**
 * In-memory artefact entry surfaced in the Context tab. `path` is absolute and uses native
 * separators; the renderer normalises to POSIX for display when needed.
 */
export interface ArtefactEntry {
  path: string;
  sizeBytes: number;
  createdAt: number;
}

export type ArtefactsTrackerEvents = {
  event: [topic: EventTopic, payload: unknown];
};

/**
 * Tools that materialise a *new* file when invoked. We listen on `tool.call.start` to stash
 * whether the target already exists, then on `tool.call.end` register the file as an artefact
 * only if it didn't exist before. The list mirrors `TurnTracker`'s set so we cover the same
 * surface area; edits and patches stay out by design — they don't produce artefacts.
 */
const FILE_CREATING_TOOLS = new Set(["write", "create", "create_file", "file_write"]);

interface PendingCall {
  sessionId: string;
  path: string;
  existedBefore: boolean;
}

/**
 * Tracks files newly created by the agent during a session so the Context tab can surface them
 * under "Artefacts produced". In-memory only — refreshed whenever the worker is reactivated.
 *
 * Unlike `TurnTracker`, this listens on both `tool.call.start` and `tool.call.end`. Start fires
 * before the tool runs, so we can record whether the target already existed on disk; only after
 * a successful end do we know the file was created (or merely edited). This distinction is the
 * point of the "Artefacts produced" section, which excludes modifications of existing files.
 */
export class ArtefactsTracker extends EventEmitter<ArtefactsTrackerEvents> {
  private readonly pending = new Map<string, PendingCall>();
  private readonly bySession = new Map<string, Map<string, ArtefactEntry>>();

  constructor(sessionManager: SessionManager) {
    super();
    sessionManager.on("event", (topic, payload) => {
      if (topic === EVENT_SESSION_TOOL_CALL_START) {
        void this.handleToolStart(payload);
      } else if (topic === EVENT_SESSION_TOOL_CALL_END) {
        void this.handleToolEnd(payload);
      } else if (topic === EVENT_SESSION_WORKER_EXIT) {
        this.handleWorkerExit(payload);
      }
    });
  }

  list(sessionId: string): ArtefactEntry[] {
    const entries = this.bySession.get(sessionId);
    return entries ? [...entries.values()] : [];
  }

  forget(sessionId: string): void {
    this.bySession.delete(sessionId);
    for (const [callId, pending] of this.pending) {
      if (pending.sessionId === sessionId) this.pending.delete(callId);
    }
  }

  private async handleToolStart(payload: unknown): Promise<void> {
    const p = payload as {
      sessionId?: string;
      callId?: string;
      name?: string;
      input?: unknown;
    };
    if (!p?.sessionId || !p.callId || !p.name) return;
    if (!FILE_CREATING_TOOLS.has(p.name)) return;
    const filePath = extractFilePath(p.input);
    if (!filePath) return;
    const existedBefore = await fileExists(filePath);
    this.pending.set(p.callId, {
      sessionId: p.sessionId,
      path: filePath,
      existedBefore,
    });
  }

  private async handleToolEnd(payload: unknown): Promise<void> {
    const p = payload as {
      sessionId?: string;
      callId?: string;
      isError?: boolean;
    };
    if (!p?.callId) return;
    const pending = this.pending.get(p.callId);
    if (!pending) return;
    this.pending.delete(p.callId);
    if (p.isError) return;
    if (pending.existedBefore) return;

    let sizeBytes = 0;
    try {
      const info = await stat(pending.path);
      if (!info.isFile()) return; // Tool succeeded but didn't actually create a file.
      sizeBytes = info.size;
    } catch {
      return; // File vanished between end-of-call and our stat — skip.
    }

    const entries = this.bySession.get(pending.sessionId) ?? new Map<string, ArtefactEntry>();
    if (entries.has(pending.path)) {
      // Same path created twice in the same session; keep the first entry's createdAt.
      return;
    }
    const entry: ArtefactEntry = {
      path: pending.path,
      sizeBytes,
      createdAt: Date.now(),
    };
    entries.set(pending.path, entry);
    this.bySession.set(pending.sessionId, entries);

    this.emit("event", EVENT_SESSION_ARTEFACTS_CHANGED, {
      sessionId: pending.sessionId,
      artefacts: [...entries.values()],
    });
  }

  private handleWorkerExit(payload: unknown): void {
    const p = payload as { sessionId?: string };
    if (!p?.sessionId) return;
    this.forget(p.sessionId);
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

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
