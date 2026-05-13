import type { Project, ProjectSummary } from "@pi-deck/core/domain/project.js";
import type { SessionSummary } from "@pi-deck/core/domain/session.js";
import { create } from "zustand";
import { ProtocolClient } from "../../lib/transport/protocol-client.js";
import { type ConnectionStatus, WsClient } from "../../lib/transport/ws-client.js";

const MAX_EVENT_LOG = 500;

interface EventLogEntry {
  ts: number;
  topic: string;
  payload: unknown;
}

export interface SessionsStoreState {
  status: ConnectionStatus;
  client: ProtocolClient | undefined;
  projects: ProjectSummary[];
  activeProject: Project | undefined;
  sessions: SessionSummary[];
  activeSessionId: string | undefined;
  eventLog: EventLogEntry[];
  hostVersion: string | undefined;
  protocolVersion: number | undefined;
  initError: string | undefined;

  initialize: () => Promise<void>;
  pingHost: () => Promise<{ pong: true; hostVersion: string; protocolVersion: number }>;
  openProject: (path: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  createSession: () => Promise<void>;
  activateSession: (id: string) => Promise<void>;
  deactivateSession: (id: string) => Promise<void>;
  sendPrompt: (text: string) => Promise<void>;
  cancelPrompt: () => Promise<void>;
  setActiveSessionId: (id: string | undefined) => void;
  clearEventLog: () => void;
}

declare global {
  interface Window {
    bridge?: {
      connect?: () => Promise<{ url: string; token: string } | undefined>;
    };
  }
}

export const useSessionsStore = create<SessionsStoreState>((set, get) => ({
  status: "idle",
  client: undefined,
  projects: [],
  activeProject: undefined,
  sessions: [],
  activeSessionId: undefined,
  eventLog: [],
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
      onEvent: (topic, payload) => {
        set((state) => {
          const next = [...state.eventLog, { ts: Date.now(), topic, payload }];
          if (next.length > MAX_EVENT_LOG) next.splice(0, next.length - MAX_EVENT_LOG);
          return { eventLog: next };
        });
      },
    });
    const client = new ProtocolClient(ws);
    set({ client });
    ws.connect();
  },

  pingHost: async () => {
    const client = get().client;
    if (!client) throw new Error("Client not initialized");
    const result = await client.ping();
    set({ hostVersion: result.hostVersion, protocolVersion: result.protocolVersion });
    return result;
  },

  openProject: async (path) => {
    const client = get().client;
    if (!client) throw new Error("Client not initialized");
    const { project } = await client.call("project.open", { path });
    set({ activeProject: project });
    await get().refreshProjects();
  },

  refreshProjects: async () => {
    const client = get().client;
    if (!client) return;
    const { projects } = await client.call("project.list", {});
    set({ projects });
  },

  createSession: async () => {
    const client = get().client;
    const project = get().activeProject;
    if (!client || !project) throw new Error("No active project");
    const { session } = await client.call("session.create", { projectId: project.id });
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
    await client.call("session.prompt", { sessionId: id, text });
  },

  cancelPrompt: async () => {
    const client = get().client;
    const id = get().activeSessionId;
    if (!client || !id) return;
    await client.call("session.cancel", { sessionId: id });
  },

  setActiveSessionId: (id) => set({ activeSessionId: id }),
  clearEventLog: () => set({ eventLog: [] }),
}));
