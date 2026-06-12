import type { SessionCommandInfo } from "@pi-deck/core/protocol/commands.js";
import { create } from "zustand";
import { useSessionsStore } from "../../sessions/useSessionsStore.js";

/**
 * Slash-command catalogues for the composers' `/` autocomplete, cached for instant rendering
 * and silently re-fetched on every menu trigger (skills can be installed mid-run).
 *
 * Two scopes: `bySession` asks the live session worker (`session.commands` — the full list,
 * including extension commands); `byProject` is the disk-derived list (`project.commands` —
 * templates + skills only) for the BLANK screen, where no worker exists yet.
 */
interface SlashCommandsState {
  bySession: Record<string, SessionCommandInfo[] | undefined>;
  byProject: Record<string, SessionCommandInfo[] | undefined>;
  fetch: (sessionId: string) => void;
  fetchForProject: (projectId: string) => void;
}

const inFlight = new Set<string>();

export const useSlashCommandsStore = create<SlashCommandsState>((set) => ({
  bySession: {},
  byProject: {},

  fetch: (sessionId) => {
    const client = useSessionsStore.getState().client;
    const key = `s:${sessionId}`;
    if (!client || inFlight.has(key)) return;
    inFlight.add(key);
    void (async () => {
      try {
        const { commands } = await client.call("session.commands", { sessionId });
        set((s) => ({ bySession: { ...s.bySession, [sessionId]: commands } }));
      } catch {
        // Worker may be respawning; the cached list (if any) keeps serving the menu.
      } finally {
        inFlight.delete(key);
      }
    })();
  },

  fetchForProject: (projectId) => {
    const client = useSessionsStore.getState().client;
    const key = `p:${projectId}`;
    if (!client || inFlight.has(key)) return;
    inFlight.add(key);
    void (async () => {
      try {
        const { commands } = await client.call("project.commands", { projectId });
        set((s) => ({ byProject: { ...s.byProject, [projectId]: commands } }));
      } catch {
        // Host hiccup — the cached list (if any) keeps serving the menu.
      } finally {
        inFlight.delete(key);
      }
    })();
  },
}));

/** Commands matching the composer's current `/`-token, prefix matches first. */
export function filterCommands(
  commands: readonly SessionCommandInfo[] | undefined,
  query: string,
): SessionCommandInfo[] {
  if (!commands) return [];
  const q = query.toLowerCase();
  const starts: SessionCommandInfo[] = [];
  const contains: SessionCommandInfo[] = [];
  for (const c of commands) {
    const name = c.name.toLowerCase();
    if (name.startsWith(q)) starts.push(c);
    else if (q && name.includes(q)) contains.push(c);
  }
  return [...starts, ...contains];
}
