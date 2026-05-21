import { useEffect, useMemo } from "react";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { useGitStore } from "./useGitStore.js";

/**
 * Returns the set of repo-relative paths the active session has written / edited so far.
 * Pulls the initial snapshot via the `git.turnTouches` command on mount + activeSession
 * change; live deltas arrive via `git.turnTouches.changed` (routed in event-router).
 *
 * `projectRoot` is the absolute working-tree root; passing it lets us normalise tool inputs
 * (which arrive as absolute paths or repo-relative) into a single relative form so the
 * comparison against `GitChange.path` lights up correctly.
 */
export function useTurnFileTouches(projectRoot: string | undefined): Set<string> {
  const sessionId = useSessionsStore((s) => s.activeSessionId);
  const client = useSessionsStore((s) => s.client);
  const raw = useGitStore((s) => (sessionId ? s.touchesBySession[sessionId] : undefined));
  const apply = useGitStore((s) => s.applyTurnTouches);

  useEffect(() => {
    if (!client || !sessionId) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await client.call("git.turnTouches", { sessionId });
        if (!cancelled) apply(sessionId, result.paths);
      } catch {
        // Non-fatal — the live channel will populate the set as new edits land.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, sessionId, apply]);

  return useMemo(() => {
    if (!raw || raw.length === 0) return new Set<string>();
    if (!projectRoot) return new Set(raw);
    const out = new Set<string>();
    const normRoot = projectRoot.replace(/\\/g, "/").replace(/\/$/, "");
    for (const p of raw) {
      const norm = p.replace(/\\/g, "/");
      if (norm.startsWith(`${normRoot}/`)) {
        out.add(norm.slice(normRoot.length + 1));
      } else {
        out.add(norm);
      }
    }
    return out;
  }, [raw, projectRoot]);
}
