import type {
  AgentMode,
  SessionModelRef,
  SessionSummary,
  ThinkingLevel,
} from "@pi-deck/core/domain/session.js";
import type { PromptAttachment, PromptImage } from "@pi-deck/core/protocol/commands.js";
import { create } from "zustand";
import { humanizeError } from "../../lib/format/humanize-error.js";
import { routeEvent } from "../../lib/transport/event-router.js";
import { ProtocolClient } from "../../lib/transport/protocol-client.js";
import { type ConnectionStatus, WsClient } from "../../lib/transport/ws-client.js";
import { useToastStore } from "../_status/useToastStore.js";
import type { UserMessageImage } from "../chat/types.js";
import { useMessagesStore } from "../chat/useMessagesStore.js";
import { useProvidersStore } from "../models/useProvidersStore.js";
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
  /** Cache of per-project sessions populated lazily by the overview / rail. */
  sessionsByProject: Record<string, SessionSummary[]>;
  loadingByProject: Record<string, boolean>;
  errorByProject: Record<string, string | undefined>;
  /** Archived sessions across every project. Loaded eagerly so the ARCHIVE rail group
   * can render its count even before any project block is expanded. */
  archivedSessions: SessionSummary[];
  archivedLoaded: boolean;

  initialize: () => Promise<void>;
  refreshSessions: (projectId: string) => Promise<void>;
  loadProjectSessions: (projectId: string) => Promise<void>;
  loadArchivedSessions: () => Promise<void>;
  createSession: (
    projectId: string,
    opts?: {
      modelRef?: SessionModelRef;
      thinkingLevel?: ThinkingLevel;
      agentMode?: AgentMode;
    },
  ) => Promise<void>;
  activateSession: (id: string) => Promise<void>;
  deactivateSession: (id: string) => Promise<void>;
  archiveSession: (id: string) => Promise<void>;
  unarchiveSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  sendPrompt: (
    text: string,
    opts?: {
      agentMode?: AgentMode;
      attachments?: PromptAttachment[];
      /** Wire payload (mimeType + base64). */
      images?: PromptImage[];
      /** Optimistic thumbnails persisted onto the user message for history rendering. */
      messageImages?: UserMessageImage[];
    },
  ) => Promise<void>;
  cancelPrompt: () => Promise<void>;
  setActiveSessionId: (id: string | undefined) => void;
  /** Merge backend-pushed updates (e.g. title rename) into the local sessions list. */
  updateSessionMetadata: (sessionId: string, partial: Partial<SessionSummary>) => void;
}

/** Dedupes concurrent loadProjectSessions calls without leaking into store state. */
const projectFetches = new Map<string, Promise<void>>();

/**
 * Compute the new + previous slice when a session flips its archived flag. The row is
 * also shuffled between the per-project cache and the archivedSessions list so the rail
 * updates immediately without waiting for a refresh round-trip.
 */
function archivedFlagPatch(
  state: SessionsStoreState,
  sessionId: string,
  archived: boolean,
): { next: Partial<SessionsStoreState>; previous: Partial<SessionsStoreState> } {
  let target: SessionSummary | undefined;
  const sessionsByProject: Record<string, SessionSummary[]> = {};
  for (const [pid, list] of Object.entries(state.sessionsByProject)) {
    sessionsByProject[pid] = list.map((s) => {
      if (s.id !== sessionId) return s;
      target = { ...s, archived };
      return target;
    });
  }
  if (!target) {
    const fromArchive = state.archivedSessions.find((s) => s.id === sessionId);
    if (fromArchive) target = { ...fromArchive, archived };
  }
  const sessions = state.sessions.map((s) => (s.id === sessionId ? { ...s, archived } : s));
  const archivedSessions = archived
    ? target
      ? [...state.archivedSessions.filter((s) => s.id !== sessionId), target]
      : state.archivedSessions
    : state.archivedSessions.filter((s) => s.id !== sessionId);
  return {
    next: { sessions, sessionsByProject, archivedSessions },
    previous: {
      sessions: state.sessions,
      sessionsByProject: state.sessionsByProject,
      archivedSessions: state.archivedSessions,
    },
  };
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
  sessionsByProject: {},
  loadingByProject: {},
  errorByProject: {},
  archivedSessions: [],
  archivedLoaded: false,

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
    // Fire-and-forget provider hydration — the picker can render its loading state in parallel
    // with the project / session hydration below.
    void useProvidersStore.getState().refreshProviders();
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
      set((state) => ({
        sessions,
        sessionsByProject: { ...state.sessionsByProject, [projectId]: sessions },
        errorByProject: { ...state.errorByProject, [projectId]: undefined },
      }));
    } catch (err) {
      useToastStore.getState().push(humanizeError(err, "Failed to load sessions"), "error");
    } finally {
      set({ isRefreshing: false });
    }
  },

  loadProjectSessions: async (projectId) => {
    const existing = projectFetches.get(projectId);
    if (existing) return existing;
    const client = get().client;
    if (!client) return;
    const activeProjectId = useProjectsStore.getState().activeProjectId;
    const isActive = projectId === activeProjectId;
    const run = (async () => {
      set((state) => ({
        loadingByProject: { ...state.loadingByProject, [projectId]: true },
      }));
      try {
        const { sessions } = await client.call("session.list", { projectId });
        set((state) => ({
          sessionsByProject: { ...state.sessionsByProject, [projectId]: sessions },
          errorByProject: { ...state.errorByProject, [projectId]: undefined },
          // Mirror into the active-project array so legacy consumers stay in sync.
          ...(isActive ? { sessions } : {}),
        }));
      } catch (err) {
        const message = humanizeError(err, "Failed to load sessions");
        set((state) => ({
          errorByProject: { ...state.errorByProject, [projectId]: message },
        }));
      } finally {
        set((state) => ({
          loadingByProject: { ...state.loadingByProject, [projectId]: false },
        }));
        projectFetches.delete(projectId);
      }
    })();
    projectFetches.set(projectId, run);
    return run;
  },

  createSession: async (projectId, opts) => {
    const client = get().client;
    if (!client) throw new Error("Client not initialized");
    try {
      const { session } = await client.call("session.create", {
        projectId,
        modelRef: opts?.modelRef,
        thinkingLevel: opts?.thinkingLevel,
        agentMode: opts?.agentMode,
      });
      set((state) => {
        const cached = state.sessionsByProject[projectId] ?? [];
        return {
          sessions: [...state.sessions, session],
          activeSessionId: session.id,
          sessionsByProject: {
            ...state.sessionsByProject,
            [projectId]: [...cached, session],
          },
        };
      });
      useProjectsStore.getState().setLastActiveSession(projectId, session.id);
    } catch (err) {
      useToastStore.getState().push(humanizeError(err, "Failed to create session"), "error");
      throw err;
    }
  },

  loadArchivedSessions: async () => {
    const client = get().client;
    if (!client) return;
    try {
      const { sessions } = await client.call("session.listArchived", {});
      set({ archivedSessions: sessions, archivedLoaded: true });
    } catch (err) {
      useToastStore
        .getState()
        .push(humanizeError(err, "Failed to load archived sessions"), "error");
    }
  },

  archiveSession: async (id) => {
    const client = get().client;
    if (!client) return;
    const { next, previous } = archivedFlagPatch(get(), id, true);
    set(next);
    try {
      await client.call("session.archive", { sessionId: id });
    } catch (err) {
      set(previous);
      useToastStore.getState().push(humanizeError(err, "Failed to archive session"), "error");
    }
  },

  unarchiveSession: async (id) => {
    const client = get().client;
    if (!client) return;
    const { next, previous } = archivedFlagPatch(get(), id, false);
    set(next);
    try {
      await client.call("session.unarchive", { sessionId: id });
    } catch (err) {
      set(previous);
      useToastStore.getState().push(humanizeError(err, "Failed to unarchive session"), "error");
    }
  },

  deleteSession: async (id) => {
    const client = get().client;
    if (!client) return;
    try {
      await client.call("session.delete", { sessionId: id });
      set((state) => {
        const sessionsByProject: Record<string, SessionSummary[]> = {};
        for (const [pid, list] of Object.entries(state.sessionsByProject)) {
          sessionsByProject[pid] = list.filter((s) => s.id !== id);
        }
        return {
          sessions: state.sessions.filter((s) => s.id !== id),
          sessionsByProject,
          archivedSessions: state.archivedSessions.filter((s) => s.id !== id),
          activeSessionId: state.activeSessionId === id ? undefined : state.activeSessionId,
        };
      });
    } catch (err) {
      useToastStore.getState().push(humanizeError(err, "Failed to delete session"), "error");
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

  sendPrompt: async (text, opts) => {
    const client = get().client;
    const id = get().activeSessionId;
    if (!client || !id) throw new Error("No active session");
    useMessagesStore.getState().markTurnInFlight(id, true);
    try {
      await client.call("session.prompt", {
        sessionId: id,
        text,
        agentMode: opts?.agentMode,
        attachments: opts?.attachments,
        images: opts?.images,
      });
      // Optimistically append the user message immediately on ack. The bridge will later
      // emit its own `user.message` event; the store dedups by text + time-window. The
      // attachments stay on the local entry so the user bubble can render the chips for
      // what was sent.
      useMessagesStore.getState().appendUserMessage(id, {
        messageId: `u-local-${Date.now()}`,
        text,
        createdAt: Date.now(),
        attachments: opts?.attachments,
        images: opts?.messageImages,
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
