import type { SessionSummary } from "@pi-deck/core/domain/session.js";
import { useSessionsStore } from "./useSessionsStore.js";

/**
 * Background "warm-up" for session workers.
 *
 * Opening a session for the first time pays a cold cost on the host: it spawns a
 * child-process pi worker, runs `init`, and fetches the transcript (see
 * `packages/core/src/host/session-manager.ts` `activate`). Subsequent opens are instant —
 * the worker stays alive and the renderer caches the transcript in `useMessagesStore`.
 *
 * `warmSession` triggers that activation ahead of time *without* switching the UI: it calls
 * the `session.activate` command directly rather than the store's `activateSession` (which
 * also flips `activeSessionId` / screen). The host command is idempotent — a no-op if the
 * worker is already alive — and emits `EVENT_SESSION_HISTORY_LOADED`, which the event-router
 * turns into `loadHistory`, so warming also pre-caches the transcript. By the time the user
 * clicks the row, both the worker and the transcript are ready.
 */

const warmed = new Set<string>();
const MAX_WARMED = 6;

/** Spawn + history-load a session's worker in the background, unless it's already warm. */
export function warmSession(sessionId: string): void {
  if (!sessionId || warmed.has(sessionId)) return;
  const { client, activeSessionId } = useSessionsStore.getState();
  if (!client) return;
  // The open session is already being activated through the normal path — nothing to warm.
  if (sessionId === activeSessionId) return;
  if (warmed.size >= MAX_WARMED) return;

  warmed.add(sessionId);
  client.call("session.activate", { sessionId }).catch(() => {
    // Spawn/init failed — drop the marker so a later attempt can retry.
    warmed.delete(sessionId);
  });
}

/**
 * Warm the most-recently-active, non-archived session in `sessions` (skipping the one already
 * open). Called when a project's session list loads so its likely-next open is hot.
 */
export function warmMostRecentSession(sessions: SessionSummary[]): void {
  const activeId = useSessionsStore.getState().activeSessionId;
  let best: SessionSummary | undefined;
  for (const s of sessions) {
    if (s.archived || s.id === activeId) continue;
    if (!best || s.lastActivityAt > best.lastActivityAt) best = s;
  }
  if (best) warmSession(best.id);
}

/** Forget a warmed session so its worker gets re-warmed next time (call on worker exit). */
export function forgetWarmedSession(sessionId: string): void {
  warmed.delete(sessionId);
}

/** Test-only: reset module state between cases. */
export function __resetSessionWarmup(): void {
  warmed.clear();
}
