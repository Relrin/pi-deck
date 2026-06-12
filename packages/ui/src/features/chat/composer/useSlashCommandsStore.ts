import type { SessionCommandInfo } from "@pi-deck/core/protocol/commands.js";
import { create } from "zustand";
import { useSessionsStore } from "../../sessions/useSessionsStore.js";

/**
 * Per-session slash-command catalogue for the composer's `/` autocomplete. The list lives in
 * the session worker's resource loader, so it's fetched over `session.commands` — cached for
 * instant rendering and silently re-fetched every time the menu opens (skills can be
 * installed mid-session).
 */
interface SlashCommandsState {
  bySession: Record<string, SessionCommandInfo[] | undefined>;
  fetch: (sessionId: string) => void;
}

const inFlight = new Set<string>();

export const useSlashCommandsStore = create<SlashCommandsState>((set) => ({
  bySession: {},

  fetch: (sessionId) => {
    const client = useSessionsStore.getState().client;
    if (!client || inFlight.has(sessionId)) return;
    inFlight.add(sessionId);
    void (async () => {
      try {
        const { commands } = await client.call("session.commands", { sessionId });
        set((s) => ({ bySession: { ...s.bySession, [sessionId]: commands } }));
      } catch {
        // Worker may be respawning; the cached list (if any) keeps serving the menu.
      } finally {
        inFlight.delete(sessionId);
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
