import type { ThemeListing, ThemeSpec } from "@pi-deck/core";
import type { SessionModelRef, ThinkingLevel } from "@pi-deck/core/domain/session.js";
import type { FsNode } from "@pi-deck/core/fs/types.js";
import type { GitStatus } from "@pi-deck/core/git/types.js";
import {
  ContextUsage,
  EVENT_FS_TREE_CHANGED,
  EVENT_GIT_STATUS_CHANGED,
  EVENT_GIT_TURN_TOUCHES_CHANGED,
  EVENT_HOST_ERROR,
  EVENT_PLAN_FILE_CHANGED,
  EVENT_PROVIDER_CHANGED,
  EVENT_SESSION_AGENT_EVENT,
  EVENT_SESSION_HISTORY_LOADED,
  EVENT_SESSION_MESSAGE_DELTA,
  EVENT_SESSION_MODEL_CHANGED,
  EVENT_SESSION_TOOL_APPROVAL_REQUESTED,
  EVENT_SESSION_TOOL_CALL_END,
  EVENT_SESSION_TOOL_CALL_START,
  EVENT_SESSION_TOOL_CALL_UPDATE,
  EVENT_SESSION_TURN_END,
  EVENT_SESSION_USER_MESSAGE,
  EVENT_SESSION_WORKER_EXIT,
  EVENT_THEME_CHANGED,
  TokenUsage,
} from "@pi-deck/core/protocol/events.js";
import { useNotificationStore } from "../../features/_status/useNotificationStore.js";
import { resetHighlighter } from "../../features/chat/messages/code-highlight.js";
import type { MessageEntry, ToolCallEntry } from "../../features/chat/types.js";
import { useMessagesStore } from "../../features/chat/useMessagesStore.js";
import { useUsageStore } from "../../features/chat/useUsageStore.js";
import { useFileTreeStore } from "../../features/files/useFileTreeStore.js";
import { useGitStore } from "../../features/git/useGitStore.js";
import { useProvidersStore } from "../../features/models/useProvidersStore.js";
import { usePlanStore } from "../../features/plan-panel/usePlanStore.js";
import { useProjectsStore } from "../../features/sessions/useProjectsStore.js";
import { useSessionsStore } from "../../features/sessions/useSessionsStore.js";
import { useThemeStore } from "../../theme/useThemeStore.js";

type Payload = Record<string, unknown>;

function asPayload(p: unknown): Payload {
  return typeof p === "object" && p !== null ? (p as Payload) : {};
}

export function routeEvent(topic: string, rawPayload: unknown): void {
  const payload = asPayload(rawPayload);

  if (topic === EVENT_THEME_CHANGED) {
    void handleThemeChanged(payload);
    return;
  }
  if (topic === EVENT_PROVIDER_CHANGED) {
    const providerId = typeof payload.providerId === "string" ? payload.providerId : undefined;
    void useProvidersStore.getState().applyProviderChanged(providerId);
    return;
  }
  if (topic === EVENT_GIT_STATUS_CHANGED) {
    const projectId = typeof payload.projectId === "string" ? payload.projectId : "";
    const status = payload.status as GitStatus | undefined;
    if (projectId && status) {
      useGitStore.getState().applyStatusChanged(projectId, status);
    }
    return;
  }
  if (topic === EVENT_GIT_TURN_TOUCHES_CHANGED) {
    const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
    const paths = Array.isArray(payload.paths)
      ? (payload.paths.filter((p) => typeof p === "string") as string[])
      : [];
    if (sessionId) {
      useGitStore.getState().applyTurnTouches(sessionId, paths);
    }
    return;
  }
  if (topic === EVENT_FS_TREE_CHANGED) {
    const projectId = typeof payload.projectId === "string" ? payload.projectId : "";
    const added = Array.isArray(payload.added) ? (payload.added as FsNode[]) : [];
    const removed = Array.isArray(payload.removed)
      ? (payload.removed.filter((p) => typeof p === "string") as string[])
      : [];
    if (projectId) {
      useFileTreeStore.getState().applyTreeChanged(projectId, added, removed);
    }
    return;
  }
  if (topic === EVENT_PLAN_FILE_CHANGED) {
    const sid = typeof payload.sessionId === "string" ? payload.sessionId : "";
    const path = typeof payload.path === "string" ? payload.path : "";
    // `content` is intentionally nullable — the host emits `null` when the file is missing
    // (e.g. just after an external delete or before the agent's first plan-mode write).
    const content =
      typeof payload.content === "string"
        ? payload.content
        : payload.content === null
          ? null
          : undefined;
    if (sid && path && content !== undefined) {
      usePlanStore.getState().applyPlanFileChanged(sid, path, content);
    }
    return;
  }
  if (topic === EVENT_SESSION_MODEL_CHANGED) {
    const sid = typeof payload.sessionId === "string" ? payload.sessionId : "";
    const modelRef = payload.modelRef as SessionModelRef | undefined;
    if (sid && modelRef) {
      useProvidersStore
        .getState()
        .applySessionModelChanged(
          sid,
          modelRef,
          payload.thinkingLevel as ThinkingLevel | undefined,
        );
    }
    return;
  }

  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
  if (!sessionId && topic !== EVENT_HOST_ERROR) return;

  switch (topic) {
    case EVENT_SESSION_USER_MESSAGE: {
      useMessagesStore.getState().appendUserMessage(sessionId, {
        messageId: String(payload.messageId ?? `u-${Date.now()}`),
        text: String(payload.text ?? ""),
        createdAt: Number(payload.createdAt ?? Date.now()),
      });
      return;
    }
    case EVENT_SESSION_MESSAGE_DELTA: {
      useMessagesStore.getState().appendAssistantDelta(sessionId, payload.event, payload.message);
      return;
    }
    case EVENT_SESSION_TOOL_CALL_START: {
      useMessagesStore.getState().applyToolCallStart(sessionId, {
        callId: String(payload.callId ?? ""),
        name: String(payload.name ?? ""),
        input: payload.input,
      });
      return;
    }
    case EVENT_SESSION_TOOL_CALL_UPDATE: {
      useMessagesStore.getState().applyToolCallUpdate(sessionId, {
        callId: String(payload.callId ?? ""),
        partialResult: payload.partialResult,
      });
      return;
    }
    case EVENT_SESSION_TOOL_CALL_END: {
      useMessagesStore.getState().applyToolCallEnd(sessionId, {
        callId: String(payload.callId ?? ""),
        result: payload.result,
        isError: Boolean(payload.isError),
      });
      return;
    }
    case EVENT_SESSION_TURN_END: {
      useMessagesStore.getState().endTurn(sessionId, Boolean(payload.cancelled));
      const usage = TokenUsage.safeParse(payload.usage);
      if (usage.success) {
        const ctx = ContextUsage.safeParse(payload.contextUsage);
        useUsageStore
          .getState()
          .setTurnUsage(sessionId, usage.data, ctx.success ? ctx.data : undefined);
      }
      // pi may have generated a title for this session on its first turn. Refresh from the
      // backend so the sidebar reflects it without a manual reload. Cheap call; sessions
      // store dedups its own loading state.
      scheduleSidebarRefresh();
      return;
    }
    case EVENT_SESSION_WORKER_EXIT: {
      useMessagesStore.getState().markTurnInFlight(sessionId, false);
      return;
    }
    case EVENT_SESSION_HISTORY_LOADED: {
      // Wire payload carries arrays; the store wants a MessageEntry[] plus a
      // Record<callId, ToolCallEntry>. Shape-conformity is enforced upstream by zod, so we
      // cast through `unknown` rather than re-validating per field here.
      const rawMessages = Array.isArray(payload.messages) ? (payload.messages as unknown[]) : [];
      const rawToolCalls = Array.isArray(payload.toolCalls) ? (payload.toolCalls as unknown[]) : [];
      const toolCalls: Record<string, ToolCallEntry> = {};
      for (const tc of rawToolCalls as ToolCallEntry[]) {
        if (tc && typeof tc.id === "string") toolCalls[tc.id] = tc;
      }
      useMessagesStore.getState().loadHistory(sessionId, {
        messages: rawMessages as MessageEntry[],
        toolCalls,
      });
      return;
    }
    case EVENT_SESSION_AGENT_EVENT: {
      // The bridge forwards every pi event raw; surface prompt errors as notifications so
      // the user sees auth/model/config failures instead of a silent "Stop" button.
      const event = payload.event as { type?: string; message?: string } | undefined;
      if (event?.type === "prompt_error") {
        useNotificationStore.getState().error(event.message ?? "pi reported a prompt error");
        useMessagesStore.getState().markTurnInFlight(sessionId, false);
      }
      return;
    }
    case EVENT_SESSION_TOOL_APPROVAL_REQUESTED: {
      // The agent-mode plugin emits this when a mutating tool needs the user's nod (e.g. in
      // `ask` mode, or `accept-edits` for a path outside the allowlist). We attach the pending
      // approval to the existing tool-call entry so `<ApprovalPill>` can render inline on the
      // tool-call card without a separate store.
      const approvalId = typeof payload.approvalId === "string" ? payload.approvalId : "";
      const callId = typeof payload.toolCallId === "string" ? payload.toolCallId : "";
      const reason = typeof payload.reason === "string" ? payload.reason : undefined;
      if (approvalId && callId) {
        useMessagesStore
          .getState()
          .applyToolApprovalRequested(sessionId, { callId, approvalId, reason });
      }
      return;
    }
    case EVENT_HOST_ERROR: {
      const msg = typeof payload.message === "string" ? payload.message : "Host error";
      useNotificationStore.getState().error(msg);
      return;
    }
    default:
      return;
  }
}

async function handleThemeChanged(payload: Payload): Promise<void> {
  const activeName = typeof payload.activeName === "string" ? payload.activeName : "";
  if (!activeName) return;
  const themes = Array.isArray(payload.themes) ? (payload.themes as ThemeListing[]) : [];

  let spec: ThemeSpec | undefined = payload.spec as ThemeSpec | undefined;
  if (!spec) {
    const client = useSessionsStore.getState().client;
    if (client) {
      try {
        spec = await client.themes.get(activeName);
      } catch {
        spec = undefined;
      }
    }
  }
  useThemeStore.getState().applySpec(activeName, spec, themes);
  resetHighlighter();
}

// Debounce so a rapid sequence of turn.end events (multiple sessions, fast retries) collapses
// into a single session.list round trip. Avoids hammering the host on cascade events.
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSidebarRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = undefined;
    const projectId = useProjectsStore.getState().activeProjectId;
    if (!projectId) return;
    void useSessionsStore.getState().refreshSessions(projectId);
  }, 200);
}
