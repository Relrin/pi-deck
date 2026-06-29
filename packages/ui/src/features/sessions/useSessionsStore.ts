import type {
  AgentMode,
  PlanGatePolicy,
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
import { useNotificationStore } from "../_status/useNotificationStore.js";
import { useComposerStore } from "../chat/composer/useComposerStore.js";
import type { UserMessageImage } from "../chat/types.js";
import { useMessagesStore } from "../chat/useMessagesStore.js";
import { useLspCustomServersStore } from "../editor/lsp/useLspCustomServersStore.js";
import { useProvidersStore } from "../models/useProvidersStore.js";
import { useToolsStore } from "../tools/useToolsStore.js";
import { warmMostRecentSession } from "./sessionWarmup.js";
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
      planGatePolicy?: PlanGatePolicy;
      excludedTools?: string[];
    },
  ) => Promise<void>;
  activateSession: (id: string) => Promise<void>;
  deactivateSession: (id: string) => Promise<void>;
  archiveSession: (id: string) => Promise<void>;
  unarchiveSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
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
  /** Hard-stop escalation: kill the worker process when a graceful cancel doesn't bite. */
  forceStopPrompt: () => Promise<void>;
  setActiveSessionId: (id: string | undefined) => void;
  /** Merge backend-pushed updates (e.g. title rename) into the local sessions list. */
  updateSessionMetadata: (sessionId: string, partial: Partial<SessionSummary>) => void;
  /**
   * Stamp a session's `lastActivityAt` with the current wall clock. Drives the
   * "most-recent-first" sort in the rail so activating or prompting a session pops it to
   * the top without waiting for a server round-trip — the host applies the same update on
   * its side so a later `session.list` refresh re-confirms the order.
   */
  bumpLastActivity: (sessionId: string) => void;
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

let initStarted = false;

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
    if (get().client || initStarted) return;
    initStarted = true;
    const bridge = window.bridge?.connect;
    if (!bridge) {
      initStarted = false;
      set({ initError: "Preload bridge not available" });
      return;
    }
    const info = await bridge();
    if (!info) {
      initStarted = false;
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
    // Same for the user-defined LSP servers: the editor needs the list synchronously when a
    // tab opens, so mirror it now rather than on first Settings visit.
    void useLspCustomServersStore
      .getState()
      .refresh(client)
      .catch(() => {});
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
      useNotificationStore.getState().error(humanizeError(err, "Failed to load workspace"));
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
      // Warm the project's most-recent session's worker so its first open is instant.
      warmMostRecentSession(sessions);
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, "Failed to load sessions"));
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
        planGatePolicy: opts?.planGatePolicy,
        excludedTools: opts?.excludedTools,
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
      // Pre-seed an empty transcript so the session view shows the intro immediately instead
      // of the cold-load placeholder. The host re-emits the same empty history on activate.
      useMessagesStore.getState().loadHistory(session.id, { messages: [], toolCalls: {} });
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, "Failed to create session"));
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
      useNotificationStore.getState().error(humanizeError(err, "Failed to load archived sessions"));
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
      useNotificationStore.getState().error(humanizeError(err, "Failed to archive session"));
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
      useNotificationStore.getState().error(humanizeError(err, "Failed to unarchive session"));
    }
  },

  renameSession: async (id, title) => {
    const client = get().client;
    if (!client) return;
    const trimmed = title.trim();
    if (!trimmed) return;
    // Snapshot prior state so we can roll back if the server rejects the rename.
    const prevSessions = get().sessions;
    const prevByProject = get().sessionsByProject;
    const prevArchived = get().archivedSessions;
    const apply = (lists: SessionSummary[]) =>
      lists.map((s) => (s.id === id ? { ...s, title: trimmed } : s));
    const nextByProject: Record<string, SessionSummary[]> = {};
    for (const [pid, list] of Object.entries(prevByProject)) {
      nextByProject[pid] = apply(list);
    }
    set({
      sessions: apply(prevSessions),
      sessionsByProject: nextByProject,
      archivedSessions: apply(prevArchived),
    });
    try {
      await client.call("session.rename", { sessionId: id, title: trimmed });
    } catch (err) {
      set({
        sessions: prevSessions,
        sessionsByProject: prevByProject,
        archivedSessions: prevArchived,
      });
      useNotificationStore.getState().error(humanizeError(err, "Failed to rename session"));
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
      useNotificationStore.getState().error(humanizeError(err, "Failed to delete session"));
      throw err;
    }
  },

  activateSession: async (id) => {
    const client = get().client;
    if (!client) return;

    const prevSessionId = get().activeSessionId;
    const projectsStore = useProjectsStore.getState();
    const previousProjectId = projectsStore.activeProjectId;

    // Intentionally NOT bumping lastActivityAt: opening an old session should keep its
    // position in the rail until the user actually sends a prompt. The bump happens in
    // `sendPrompt` instead.

    // Look up the session across every cache the rail may have populated — the active
    // project's `sessions`, the per-project `sessionsByProject` (rail groups), and the
    // archived list. Without this lookup, switching to a session in a different project
    // would leave `activeProjectId` pointing at the OLD workspace, desynchronising the
    // file tree, git sidebar, branch picker, and composer model defaults.
    const summary = findSessionAcrossProjects(get(), id);
    const targetProjectId = summary?.projectId ?? previousProjectId;

    set({ activeSessionId: id });
    // Opening a session counts as viewing it: clear any unviewed done/failed outcome so its rail
    // dot settles to neutral idle instead of lingering green/red.
    useMessagesStore.getState().markViewed(id);

    if (targetProjectId && targetProjectId !== previousProjectId) {
      projectsStore.setActive(targetProjectId);
      // Refresh the global `sessions` array so the composer + topbar see the new
      // project's sessions, not the previous one's leftovers.
      void get().refreshSessions(targetProjectId);
    }
    if (targetProjectId) {
      projectsStore.setLastActiveSession(targetProjectId, id);
    }
    // Seed the picker from the session's persisted mode so the trigger label is correct
    // before the user touches it. Absent on legacy records — falls back to the store's
    // default inside `getMode`.
    if (summary?.agentMode) {
      useComposerStore.getState().seed(id, summary.agentMode);
    }
    // Sync the local mirror to the server value so the composer chip reflects the session's
    // actual exclusion list on first paint.
    useToolsStore.getState().seed(id, summary?.excludedTools);

    // Confirm with the host (idempotent on the backend). Roll the optimistic switch back if
    // the host can't activate the session, so the UI doesn't point at a dead selection.
    try {
      await client.call("session.activate", { sessionId: id });
    } catch (err) {
      set({ activeSessionId: prevSessionId });
      if (targetProjectId !== previousProjectId) {
        projectsStore.setActive(previousProjectId);
      }
      useNotificationStore.getState().error(humanizeError(err, "Failed to open session"));
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
      // Host bumps lastActivityAt on prompt too. Mirror locally so the rail re-sorts now;
      // the next session.list refresh (scheduled on turn.end) confirms the order from the
      // server.
      get().bumpLastActivity(id);
    } catch (err) {
      useMessagesStore.getState().markTurnInFlight(id, false);
      useNotificationStore.getState().error(humanizeError(err, "Failed to send prompt"));
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
      useNotificationStore.getState().error(humanizeError(err, "Failed to cancel"));
    }
  },

  forceStopPrompt: async () => {
    const client = get().client;
    const id = get().activeSessionId;
    if (!client || !id) return;
    try {
      await client.call("session.forceStop", { sessionId: id });
      // The killed worker's exit event resets the in-flight flag; no optimistic flip here
      // so the button state always mirrors what the host actually did.
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, "Failed to force-stop"));
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

  bumpLastActivity: (sessionId) =>
    set((state) => {
      const now = new Date().toISOString();
      const apply = (s: SessionSummary): SessionSummary =>
        s.id === sessionId ? { ...s, lastActivityAt: now } : s;
      const sessionsByProject: Record<string, SessionSummary[]> = {};
      for (const [pid, list] of Object.entries(state.sessionsByProject)) {
        sessionsByProject[pid] = list.map(apply);
      }
      return {
        sessions: state.sessions.map(apply),
        sessionsByProject,
        archivedSessions: state.archivedSessions.map(apply),
      };
    }),
}));

/**
 * Look up a session by id across every cache the rail may have populated. Order matters
 * slightly: the active-project `sessions` array is freshest (the latest `session.list`
 * round-trip wrote it), so we check it first; falling back to `sessionsByProject` (where
 * the rail's lazy per-project loads land), then `archivedSessions`.
 *
 * Returns `undefined` if the session isn't in any cache — e.g. a stale id from a project
 * we haven't loaded yet. The caller treats this as "leave activeProjectId alone" rather
 * than guessing.
 */
function findSessionAcrossProjects(
  state: SessionsStoreState,
  sessionId: string,
): SessionSummary | undefined {
  const fromActive = state.sessions.find((s) => s.id === sessionId);
  if (fromActive) return fromActive;
  for (const list of Object.values(state.sessionsByProject)) {
    const found = list.find((s) => s.id === sessionId);
    if (found) return found;
  }
  return state.archivedSessions.find((s) => s.id === sessionId);
}
