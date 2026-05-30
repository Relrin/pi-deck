import { create } from "zustand";
import { persist } from "zustand/middleware";
import { humanizeError } from "../../lib/format/humanize-error.js";
import { useNotificationStore } from "../_status/useNotificationStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";

/**
 * Per-tool disablement state. Mirrors the server-side `excludedTools` on `SessionRecord`,
 * plus a local default that the intro composer applies when creating new sessions.
 *
 * Pattern follows `useComposerStore` (per-session agent mode):
 *  - `bySession` is a renderer-side mirror so the popover renders before the server
 *    round-trip completes. Truth of record is the session's `excludedTools` field on
 *    the host (see `host/session-manager.ts`); `seed` syncs from there on activate.
 *  - `defaultExcludedTools` is renderer-only state, persisted to localStorage. The intro
 *    composer copies it into the `session.create` call when starting a fresh session.
 */
interface ToolsStoreState {
  /** Tool ids disabled by default for new sessions. Empty = all built-ins enabled. */
  defaultExcludedTools: string[];
  /** Per-session mirror of the server-side excluded list. */
  bySession: Record<string, string[]>;

  /** Read the effective excluded list for a session, falling back to local mirror →
   *  server record → default. */
  getExcluded: (sessionId: string | undefined) => string[];
  /** Replace the default exclusion list. Persisted locally; takes effect on the next
   *  `session.create`. Does NOT mutate existing sessions. */
  setDefaultExcludedTools: (tools: string[]) => void;
  /** Seed the local mirror for a session from its server record. Called when the session
   *  list refreshes so the picker reflects persisted state without a user interaction. */
  seed: (sessionId: string, tools: string[] | undefined) => void;
  /** Replace the per-session exclusion list and call the host. Optimistic — reverts on
   *  RPC error so the UI doesn't claim a config the agent isn't actually using. */
  setSessionExcludedTools: (sessionId: string, tools: string[]) => Promise<void>;
}

const STORAGE_KEY = "pi-deck:tools";

function normalize(input: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of input) {
    const id = raw.trim();
    if (id) seen.add(id);
  }
  return [...seen].sort();
}

function sameList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export const useToolsStore = create<ToolsStoreState>()(
  persist(
    (set, get) => ({
      defaultExcludedTools: [],
      bySession: {},

      getExcluded: (sessionId) => {
        if (!sessionId) return get().defaultExcludedTools;
        const local = get().bySession[sessionId];
        if (local) return local;
        const summary = useSessionsStore.getState().sessions.find((s) => s.id === sessionId);
        return summary?.excludedTools ?? get().defaultExcludedTools;
      },

      setDefaultExcludedTools: (tools) => {
        const next = normalize(tools);
        const current = get().defaultExcludedTools;
        if (sameList(current, next)) return;
        set({ defaultExcludedTools: next });
      },

      seed: (sessionId, tools) => {
        const next = normalize(tools ?? []);
        set((state) => {
          const existing = state.bySession[sessionId];
          if (existing && sameList(existing, next)) return state;
          return { bySession: { ...state.bySession, [sessionId]: next } };
        });
      },

      setSessionExcludedTools: async (sessionId, tools) => {
        const next = normalize(tools);
        const prev = get().bySession[sessionId];
        set((state) => ({ bySession: { ...state.bySession, [sessionId]: next } }));
        const client = useSessionsStore.getState().client;
        if (!client) return;
        try {
          await client.call("session.setExcludedTools", { sessionId, excludedTools: next });
        } catch (err) {
          // Roll back the optimistic update — the worker isn't actually running with this
          // exclusion list, so the picker shouldn't claim it is.
          set((state) => ({ bySession: { ...state.bySession, [sessionId]: prev ?? [] } }));
          useNotificationStore.getState().error(humanizeError(err, "Failed to update tools"));
        }
      },
    }),
    {
      name: STORAGE_KEY,
      // bySession is local mirror only — survives reload but server is authoritative.
      partialize: (state) => ({
        defaultExcludedTools: state.defaultExcludedTools,
        bySession: state.bySession,
      }),
    },
  ),
);
