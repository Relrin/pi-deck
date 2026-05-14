import type { SessionSummary } from "@pi-deck/core/domain/session.js";
import { create } from "zustand";
import { routeEvent } from "../../lib/transport/event-router.js";
import { ProtocolClient } from "../../lib/transport/protocol-client.js";
import { type ConnectionStatus, WsClient } from "../../lib/transport/ws-client.js";
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

  initialize: () => Promise<void>;
  refreshSessions: (projectId: string) => Promise<void>;
  createSession: (projectId: string) => Promise<void>;
  activateSession: (id: string) => Promise<void>;
  deactivateSession: (id: string) => Promise<void>;
  sendPrompt: (text: string) => Promise<void>;
  cancelPrompt: () => Promise<void>;
  setActiveSessionId: (id: string | undefined) => void;
}

export const useSessionsStore = create<SessionsStoreState>((set, get) => ({
  status: "idle",
  client: undefined,
  sessions: [],
  activeSessionId: undefined,
  hostVersion: undefined,
  protocolVersion: undefined,
  initError: undefined,

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
      }
    } catch {
      // Surface via toasts only if needed.
    }
  },

  refreshSessions: async (projectId) => {
    const client = get().client;
    if (!client) return;
    const { sessions } = await client.call("session.list", { projectId });
    set({ sessions });
  },

  createSession: async (projectId) => {
    const client = get().client;
    if (!client) throw new Error("Client not initialized");
    const { session } = await client.call("session.create", { projectId });
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id,
    }));
  },

  activateSession: async (id) => {
    const client = get().client;
    if (!client) return;
    await client.call("session.activate", { sessionId: id });
    set({ activeSessionId: id });
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
      throw err;
    }
  },

  cancelPrompt: async () => {
    const client = get().client;
    const id = get().activeSessionId;
    if (!client || !id) return;
    await client.call("session.cancel", { sessionId: id });
  },

  setActiveSessionId: (id) => set({ activeSessionId: id }),
}));
