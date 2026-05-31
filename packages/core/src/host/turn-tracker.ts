import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { snapshotForTurn } from "../git/snapshot.js";
import {
  EVENT_GIT_TURN_TOUCHES_CHANGED,
  EVENT_SESSION_TOOL_CALL_END,
  EVENT_SESSION_TURN_END,
  EVENT_SESSION_WORKER_EXIT,
  type EventTopic,
} from "../protocol/events.js";
import { classifyTouchedPaths, type ReviewStore, toRepoRelative } from "./review-store.js";
import type { SessionManager } from "./session-manager.js";

interface CurrentTurn {
  turnId: string;
  /** `null` when the turn started with a clean working tree — baseline collapses to HEAD. */
  stashSha: string | null;
  projectId: string;
  repoRoot: string;
  /** Repo-relative paths touched during this turn, kept distinct from the session-cumulative
   * `paths` set so the review record is per-turn. */
  paths: Set<string>;
}

interface SessionTouchState {
  paths: Set<string>;
  turnSeq: number;
  /** In-flight turn, set by `beginTurn` and finalised on `EVENT_SESSION_TURN_END`. */
  currentTurn: CurrentTurn | null;
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
 * Tracks which files each session has written / edited so the git sidebar can badge them,
 * AND captures a `git stash create` snapshot at the start of every prompt-driven turn so
 * the PR-style review flow can revert without touching the user's pre-existing
 * uncommitted work.
 *
 * Two layers of state per session:
 *   - `paths` is session-cumulative — used by the git sidebar's "touched this session" dot.
 *     Never cleared mid-session.
 *   - `currentTurn.paths` is per-turn — used to build the `ReviewTurn` record when the
 *     turn ends. Cleared on every `beginTurn` call.
 *
 * Both layers feed off the same `EVENT_SESSION_TOOL_CALL_END` stream.
 */
export class TurnTracker extends EventEmitter<TurnTrackerEvents> {
  private readonly state = new Map<string, SessionTouchState>();
  private readonly reviewStore: ReviewStore;

  constructor(sessionManager: SessionManager, reviewStore: ReviewStore) {
    super();
    this.reviewStore = reviewStore;
    sessionManager.on("event", (topic, payload) => {
      if (topic === EVENT_SESSION_TOOL_CALL_END) {
        this.handleToolEnd(payload);
      } else if (topic === EVENT_SESSION_TURN_END) {
        void this.handleTurnEnd(payload);
      } else if (topic === EVENT_SESSION_WORKER_EXIT) {
        this.handleWorkerExit(payload);
      }
    });
  }

  /**
   * Called by `SessionManager.prompt()` immediately before forwarding the user's prompt
   * to the worker. Captures the working-tree state via `git stash create`, generates a
   * fresh `turnId`, and resets the per-turn paths set so the in-flight turn doesn't
   * inherit anything from the previous one.
   *
   * Tolerates failures from the snapshot call — if we can't stash (e.g. repo missing,
   * `git stash create` errored), the turn proceeds with `stashSha = null` and reject
   * will fall back to HEAD. We prefer "agent can still run, reject is less precise"
   * over "agent can't prompt at all because git is unhappy".
   */
  async beginTurn(sessionId: string, projectId: string, repoRoot: string): Promise<string> {
    const entry = this.ensureEntry(sessionId);
    entry.turnSeq += 1;
    let stashSha: string | null = null;
    try {
      stashSha = await snapshotForTurn(repoRoot);
    } catch {
      stashSha = null;
    }
    entry.currentTurn = {
      turnId: randomUUID(),
      stashSha,
      projectId,
      repoRoot,
      paths: new Set<string>(),
    };
    return entry.currentTurn.turnId;
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

    const entry = this.ensureEntry(p.sessionId);
    const sizeBefore = entry.paths.size;
    entry.paths.add(filePath);

    // Also tag the in-flight turn (if any) so the review record's file list is per-turn.
    if (entry.currentTurn) {
      const relative = toRepoRelative(entry.currentTurn.repoRoot, filePath);
      if (relative !== null && relative.length > 0) {
        entry.currentTurn.paths.add(relative);
      }
    }

    if (entry.paths.size === sizeBefore) return; // No-op for cumulative badge: path already tracked
    this.emit("event", EVENT_GIT_TURN_TOUCHES_CHANGED, {
      sessionId: p.sessionId,
      paths: [...entry.paths],
      turnSeq: entry.turnSeq,
    });
  }

  private async handleTurnEnd(payload: unknown): Promise<void> {
    const p = payload as { sessionId?: string };
    if (!p?.sessionId) return;
    const entry = this.state.get(p.sessionId);
    const turn = entry?.currentTurn;
    if (!entry || !turn) return;
    // Hand the in-flight turn off to the review store before clearing it — a follow-up
    // `beginTurn` could otherwise race the classification.
    entry.currentTurn = null;
    if (turn.paths.size === 0) return;

    const baseline = turn.stashSha ?? "HEAD";
    const files = await classifyTouchedPaths(turn.repoRoot, baseline, [...turn.paths]);
    if (files.length === 0) return;

    this.reviewStore.recordTurn({
      turnId: turn.turnId,
      sessionId: p.sessionId,
      projectId: turn.projectId,
      stashSha: turn.stashSha,
      files,
      createdAt: Date.now(),
      repoRoot: turn.repoRoot,
    });
  }

  private handleWorkerExit(payload: unknown): void {
    const p = payload as { sessionId?: string };
    if (!p?.sessionId) return;
    this.state.delete(p.sessionId);
  }

  private ensureEntry(sessionId: string): SessionTouchState {
    let entry = this.state.get(sessionId);
    if (!entry) {
      entry = { paths: new Set<string>(), turnSeq: 0, currentTurn: null };
      this.state.set(sessionId, entry);
    }
    return entry;
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
