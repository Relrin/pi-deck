import type { SessionSummary } from "@pi-deck/core/domain/session.js";
import { create } from "zustand";
import { humanizeError } from "../../lib/format/humanize-error.js";
import { routeEvent } from "../../lib/transport/event-router.js";
import { ProtocolClient } from "../../lib/transport/protocol-client.js";
import { type ConnectionStatus, WsClient } from "../../lib/transport/ws-client.js";
import { useToastStore } from "../_status/useToastStore.js";
import { useMessagesStore } from "../chat/useMessagesStore.js";
import { useProjectsStore } from "./useProjectsStore.js";

export interface SessionsStoreState {
  status: ConnectionStatus;
  client: ProtocolClient | undefined;
  sessions: SessionSummary[];
  activeSessionId: string | undefined;
  hostVersion: string | undefined;
  protocolVersion: number | undefined;
  initError: string | undefined;
  /** True while a `session.list` round-trip is in flight; surfaces a sidebar spinner. */
  isRefreshing: boolean;

  initialize: () => Promise<void>;
  refreshSessions: (projectId: string) => Promise<void>;
  createSession: (projectId: string) => Promise<void>;
  activateSession: (id: string) => Promise<void>;
  deactivateSession: (id: string) => Promise<void>;
  sendPrompt: (text: string) => Promise<void>;
  cancelPrompt: () => Promise<void>;
  setActiveSessionId: (id: string | undefined) => void;
  /** Merge backend-pushed updates (e.g. title rename) into the local sessions list. */
  updateSessionMetadata: (sessionId: string, partial: Partial<SessionSummary>) => void;
}

export const useSessionsStore = create<SessionsStoreState>((set, get) => ({
  status: "idle",
  client: undefined,
  sessions: [],
  activeSessionId: undefined,
  hostVersion: undefined,
  protocolVersion: undefined,
  initError: undefined,
  isRefreshing: false,

  initialize: async () => {
    if (get().client) return;
    const bridge = window.bridge?.connect;
    if (!bridge) {
      set({ initError: "Preload bridge not available" });
      return;
    }
    const info = await bridge();
    if (!info) {
      set({ initError: "Backend did not provide connection info" });
      return;
    }
    const ws = new WsClient({
      url: info.url,
      token: info.token,
      onStatusChange: (status) => set({ status }),
      onEvent: routeEvent,
    });
    const client = new ProtocolClient(ws);
    set({ client });
    ws.connect();

    // After connect, do a ping to populate version, then hydrate projects.
    try {
      const result = await client.ping();
      set({ hostVersion: result.hostVersion, protocolVersion: result.protocolVersion });
    } catch {
      // ignore — will retry on reconnect
    }
    try {
      await useProjectsStore.getState().hydrateActive(client);
      const activeProjectId = useProjectsStore.getState().activeProjectId;
      if (activeProjectId) {
        await get().refreshSessions(activeProjectId);
        // After we have the sessions list, restore the project's last-active session if it
        // still exists. Otherwise leave nothing active so the empty state appears.
        const memorised = useProjectsStore.getState().lastActiveSessionByProject[activeProjectId];
        if (memorised && get().sessions.some((s) => s.id === memorised)) {
          await get().activateSession(memorised);
        }
      }
    } catch (err) {
      useToastStore.getState().push(humanizeError(err, "Failed to load workspace"), "error");
    }
  },

  refreshSessions: async (projectId) => {
    const client = get().client;
    if (!client) return;
    set({ isRefreshing: true });
    try {
      const { sessions } = await client.call("session.list", { projectId });
      set({ sessions });
    } catch (err) {
      useToastStore.getState().push(humanizeError(err, "Failed to load sessions"), "error");
    } finally {
      set({ isRefreshing: false });
    }
  },

  createSession: async (projectId) => {
    const client = get().client;
    if (!client) throw new Error("Client not initialized");
    try {
      const { session } = await client.call("session.create", { projectId });
      set((state) => ({
        sessions: [...state.sessions, session],
        activeSessionId: session.id,
      }));
      useProjectsStore.getState().setLastActiveSession(projectId, session.id);
    } catch (err) {
      useToastStore.getState().push(humanizeError(err, "Failed to create session"), "error");
      throw err;
    }
  },

  activateSession: async (id) => {
    const client = get().client;
    if (!client) return;
    try {
      await client.call("session.activate", { sessionId: id });
      set({ activeSessionId: id });
      const projectId = useProjectsStore.getState().activeProjectId;
      if (projectId) useProjectsStore.getState().setLastActiveSession(projectId, id);
    } catch (err) {
      useToastStore.getState().push(humanizeError(err, "Failed to open session"), "error");
    }
  },

  deactivateSession: async (id) => {
    const client = get().client;
    if (!client) return;
    await client.call("session.deactivate", { sessionId: id });
  },

  sendPrompt: async (text) => {
    const client = get().client;
    const id = get().activeSessionId;
    if (!client || !id) throw new Error("No active session");
    useMessagesStore.getState().markTurnInFlight(id, true);
    try {
      await client.call("session.prompt", { sessionId: id, text });
      // Optimistically append the user message immediately on ack. The bridge will later
      // emit its own `user.message` event; the store dedups by text + time-window.
      useMessagesStore.getState().appendUserMessage(id, {
        messageId: `u-local-${Date.now()}`,
        text,
        createdAt: Date.now(),
      });
    } catch (err) {
      useMessagesStore.getState().markTurnInFlight(id, false);
      useToastStore.getState().push(humanizeError(err, "Failed to send prompt"), "error");
      throw err;
    }
  },

  cancelPrompt: async () => {
    const client = get().client;
    const id = get().activeSessionId;
    if (!client || !id) return;
    try {
      await client.call("session.cancel", { sessionId: id });
    } catch (err) {
      useToastStore.getState().push(humanizeError(err, "Failed to cancel"), "error");
    }
  },

  setActiveSessionId: (id) => {
    set({ activeSessionId: id });
    const projectId = useProjectsStore.getState().activeProjectId;
    if (projectId) useProjectsStore.getState().setLastActiveSession(projectId, id);
  },

  updateSessionMetadata: (sessionId, partial) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, ...partial } : s)),
    })),
}));
