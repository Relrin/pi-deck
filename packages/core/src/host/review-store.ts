import { EventEmitter } from "node:events";
import { diffForPath } from "../git/diff.js";
import { revertPath } from "../git/revert.js";
import type { ReviewTurn } from "../protocol/commands.js";
import {
  EVENT_REVIEW_AVAILABLE,
  EVENT_REVIEW_CLEARED,
  EVENT_SESSION_WORKER_EXIT,
  type EventTopic,
} from "../protocol/events.js";
import type { SessionManager } from "./session-manager.js";

export type ReviewStoreEvents = {
  event: [topic: EventTopic, payload: unknown];
};

/**
 * Description of a turn the agent finished that mutated at least one file. Passed in by
 * the turn tracker via `recordTurn` and surfaced to the renderer through
 * `EVENT_REVIEW_AVAILABLE` and the `review.*` commands. `repoRoot` is kept internal so
 * `reject` can resolve paths without consulting `SessionManager` for each call.
 */
export interface ReviewTurnRecord extends ReviewTurn {
  repoRoot: string;
}

/**
 * Per-session list of pending PR-style reviews. Lifetime matches the session worker —
 * `SESSION_WORKER_EXIT` drops every record for that session because the stash SHA they
 * reference becomes meaningless once the working tree state has moved on.
 *
 * Accept and reject both clear the record from this store. Accept is filesystem-neutral
 * (the working tree is already what the user wants); reject runs `git checkout <baseline>`
 * or unlinks per file via `revertPath`. Per-file accept/reject mutates the record's
 * `files` array; the record is dropped once it becomes empty.
 */
export class ReviewStore extends EventEmitter<ReviewStoreEvents> {
  private readonly bySession = new Map<string, ReviewTurnRecord[]>();

  constructor(sessionManager: SessionManager) {
    super();
    sessionManager.on("event", (topic, payload) => {
      if (topic !== EVENT_SESSION_WORKER_EXIT) return;
      const p = payload as { sessionId?: string };
      if (!p?.sessionId) return;
      this.clearSession(p.sessionId);
    });
  }

  recordTurn(record: ReviewTurnRecord): void {
    const list = this.bySession.get(record.sessionId) ?? [];
    list.push(record);
    this.bySession.set(record.sessionId, list);
    this.emit("event", EVENT_REVIEW_AVAILABLE, {
      sessionId: record.sessionId,
      turn: toPublic(record),
    });
  }

  listFor(sessionId: string): ReviewTurn[] {
    return (this.bySession.get(sessionId) ?? []).map(toPublic);
  }

  async accept(sessionId: string, turnId: string): Promise<void> {
    const removed = this.dropTurn(sessionId, turnId);
    if (!removed) return;
    this.emit("event", EVENT_REVIEW_CLEARED, { sessionId, turnId });
  }

  async reject(sessionId: string, turnId: string): Promise<void> {
    const record = this.findTurn(sessionId, turnId);
    if (!record) return;
    const baseline = record.stashSha ?? "HEAD";
    for (const file of record.files) {
      await revertPath(record.repoRoot, file.path, baseline);
    }
    this.dropTurn(sessionId, turnId);
    this.emit("event", EVENT_REVIEW_CLEARED, { sessionId, turnId });
  }

  async acceptFile(sessionId: string, turnId: string, path: string): Promise<void> {
    const record = this.findTurn(sessionId, turnId);
    if (!record) return;
    record.files = record.files.filter((f) => f.path !== path);
    if (record.files.length === 0) {
      this.dropTurn(sessionId, turnId);
      this.emit("event", EVENT_REVIEW_CLEARED, { sessionId, turnId });
    }
  }

  async rejectFile(sessionId: string, turnId: string, path: string): Promise<void> {
    const record = this.findTurn(sessionId, turnId);
    if (!record) return;
    const baseline = record.stashSha ?? "HEAD";
    await revertPath(record.repoRoot, path, baseline);
    record.files = record.files.filter((f) => f.path !== path);
    if (record.files.length === 0) {
      this.dropTurn(sessionId, turnId);
      this.emit("event", EVENT_REVIEW_CLEARED, { sessionId, turnId });
    }
  }

  /**
   * Looks up the `(repoRoot, baseline)` for one specific turn. Used by the `diff.get`
   * command when the renderer asks for "the diff of file X in turn Y" — the renderer
   * only carries the turnId, so the host translates that back into a baseline.
   */
  resolveBaseline(
    sessionId: string,
    turnId: string,
  ): { repoRoot: string; baseline: "HEAD" | string } | null {
    const record = this.findTurn(sessionId, turnId);
    if (!record) return null;
    return { repoRoot: record.repoRoot, baseline: record.stashSha ?? "HEAD" };
  }

  private findTurn(sessionId: string, turnId: string): ReviewTurnRecord | undefined {
    return this.bySession.get(sessionId)?.find((t) => t.turnId === turnId);
  }

  private dropTurn(sessionId: string, turnId: string): boolean {
    const list = this.bySession.get(sessionId);
    if (!list) return false;
    const next = list.filter((t) => t.turnId !== turnId);
    if (next.length === list.length) return false;
    if (next.length === 0) this.bySession.delete(sessionId);
    else this.bySession.set(sessionId, next);
    return true;
  }

  private clearSession(sessionId: string): void {
    const list = this.bySession.get(sessionId);
    if (!list || list.length === 0) {
      this.bySession.delete(sessionId);
      return;
    }
    this.bySession.delete(sessionId);
    for (const turn of list) {
      this.emit("event", EVENT_REVIEW_CLEARED, { sessionId, turnId: turn.turnId });
    }
  }
}

function toPublic(record: ReviewTurnRecord): ReviewTurn {
  return {
    turnId: record.turnId,
    sessionId: record.sessionId,
    projectId: record.projectId,
    stashSha: record.stashSha,
    files: record.files,
    createdAt: record.createdAt,
  };
}

/**
 * Classify a list of repo-relative paths against `baseline`, producing the `A`/`M`/`D`
 * status used in the review record. Falls back to `diffForPath` per path so it inherits
 * the same untracked-file handling — slower than `git diff --name-status` but only
 * called at turn-end on small file lists.
 */
export async function classifyTouchedPaths(
  repoRoot: string,
  baseline: "HEAD" | string,
  paths: string[],
): Promise<{ path: string; status: "M" | "A" | "D" }[]> {
  const baselineArg =
    baseline === "HEAD" ? ("HEAD" as const) : { kind: "stash" as const, sha: baseline };
  const out: { path: string; status: "M" | "A" | "D" }[] = [];
  for (const path of paths) {
    try {
      const diff = await diffForPath(repoRoot, path, baselineArg);
      out.push({ path, status: diff.status });
    } catch {
      // Best-effort — skip paths we can't read; the review record just won't list them.
    }
  }
  return out;
}

/**
 * Project an absolute host-side path onto a repo-relative POSIX path, or return `null`
 * when the path escapes the repo. Pi tool calls usually report absolute paths; the
 * review record and the diff helpers all key off repo-relative paths.
 */
export function toRepoRelative(repoRoot: string, absPath: string): string | null {
  const normRoot = repoRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  const normAbs = absPath.replace(/\\/g, "/");
  if (normAbs === normRoot) return "";
  if (!normAbs.startsWith(`${normRoot}/`)) return null;
  return normAbs.slice(normRoot.length + 1);
}
