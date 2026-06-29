import { beforeEach, describe, expect, test } from "bun:test";
import {
  EVENT_HOST_ERROR,
  EVENT_PLAN_FILE_CHANGED,
  EVENT_SESSION_AGENT_EVENT,
  EVENT_SESSION_MESSAGE_DELTA,
  EVENT_SESSION_TOOL_APPROVAL_REQUESTED,
  EVENT_SESSION_TOOL_CALL_END,
  EVENT_SESSION_TOOL_CALL_START,
  EVENT_SESSION_TOOL_CALL_UPDATE,
  EVENT_SESSION_TURN_END,
  EVENT_SESSION_USER_MESSAGE,
  EVENT_SESSION_WORKER_EXIT,
} from "@pi-deck/core/protocol/events.js";
import { useNotificationStore } from "../../../src/features/_status/useNotificationStore";
import { useMessagesStore } from "../../../src/features/chat/useMessagesStore";
import { useUsageStore } from "../../../src/features/chat/useUsageStore";
import { usePlanStore } from "../../../src/features/plan-panel/usePlanStore";
import { routeEvent } from "../../../src/lib/transport/event-router";

const SID = "session-x";

beforeEach(() => {
  useMessagesStore.setState({ bySession: {} });
  useNotificationStore.setState({ notifications: [] });
  useUsageStore.setState({ bySession: {} });
  usePlanStore.setState({ bySession: {} });
});

describe("routeEvent — routing", () => {
  test("user message appends to the per-session list", () => {
    routeEvent(EVENT_SESSION_USER_MESSAGE, {
      sessionId: SID,
      messageId: "u-1",
      text: "hi",
      createdAt: 1000,
    });
    const msgs = useMessagesStore.getState().bySession[SID]?.messages ?? [];
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.kind).toBe("user");
  });

  test("message delta drives appendAssistantDelta", () => {
    routeEvent(EVENT_SESSION_MESSAGE_DELTA, {
      sessionId: SID,
      event: {},
      message: { timestamp: 1, content: [{ type: "text", text: "Hi" }] },
    });
    const msgs = useMessagesStore.getState().bySession[SID]?.messages ?? [];
    expect(msgs[0]?.kind).toBe("assistant");
  });

  test("tool call lifecycle routes start, update, end", () => {
    routeEvent(EVENT_SESSION_TOOL_CALL_START, {
      sessionId: SID,
      callId: "t-1",
      name: "bash",
      input: { command: "ls" },
    });
    routeEvent(EVENT_SESSION_TOOL_CALL_UPDATE, {
      sessionId: SID,
      callId: "t-1",
      partialResult: "partial",
    });
    routeEvent(EVENT_SESSION_TOOL_CALL_END, {
      sessionId: SID,
      callId: "t-1",
      result: "done",
      isError: false,
    });
    const call = useMessagesStore.getState().bySession[SID]?.toolCalls["t-1"];
    expect(call?.partialResult).toBe("partial");
    expect(call?.status).toBe("done");
    expect(call?.result).toBe("done");
  });

  test("turn.end marks turn not-in-flight and completes the assistant", () => {
    routeEvent(EVENT_SESSION_MESSAGE_DELTA, {
      sessionId: SID,
      event: {},
      message: { timestamp: 1, content: [{ type: "text", text: "Hi" }] },
    });
    routeEvent(EVENT_SESSION_TURN_END, { sessionId: SID, cancelled: false });
    const session = useMessagesStore.getState().bySession[SID];
    expect(session?.isTurnInFlight).toBe(false);
    expect(session?.messages.at(-1)?.kind === "assistant" && session.messages.at(-1)).toBeTruthy();
  });

  test("worker exit mid-turn clears the in-flight flag and records a failed outcome", () => {
    useMessagesStore.getState().markTurnInFlight(SID, true);
    routeEvent(EVENT_SESSION_WORKER_EXIT, { sessionId: SID, code: 1, signal: null });
    const session = useMessagesStore.getState().bySession[SID];
    expect(session?.isTurnInFlight).toBe(false);
    expect(session?.lastOutcome).toBe("failed");
  });

  test("agent prompt_error surfaces a notification and marks the turn failed", () => {
    useMessagesStore.getState().markTurnInFlight(SID, true);
    routeEvent(EVENT_SESSION_AGENT_EVENT, {
      sessionId: SID,
      event: { type: "prompt_error", message: "auth failed" },
    });
    expect(useNotificationStore.getState().notifications.length).toBe(1);
    expect(useNotificationStore.getState().notifications[0]?.kind).toBe("error");
    const session = useMessagesStore.getState().bySession[SID];
    expect(session?.isTurnInFlight).toBe(false);
    expect(session?.lastOutcome).toBe("failed");
  });

  test("turn.end with usage + contextUsage populates useUsageStore", () => {
    routeEvent(EVENT_SESSION_TURN_END, {
      sessionId: SID,
      cancelled: false,
      usage: { input: 100, output: 50, cacheRead: 10, cacheWrite: 5, total: 165 },
      contextUsage: { tokens: 1234, contextWindow: 200_000, percent: 0.617 },
    });
    const u = useUsageStore.getState().bySession[SID];
    expect(u?.lastTurn.input).toBe(100);
    expect(u?.lastTurn.total).toBe(165);
    expect(u?.context?.tokens).toBe(1234);
    expect(u?.context?.contextWindow).toBe(200_000);
  });

  test("turn.end without usage leaves useUsageStore untouched", () => {
    routeEvent(EVENT_SESSION_TURN_END, { sessionId: SID, cancelled: false });
    expect(useUsageStore.getState().bySession[SID]).toBeUndefined();
  });

  test("host error surfaces a notification", () => {
    routeEvent(EVENT_HOST_ERROR, { message: "transport failed" });
    expect(useNotificationStore.getState().notifications[0]?.title).toBe("transport failed");
  });

  test("events without sessionId are ignored (except host error)", () => {
    routeEvent(EVENT_SESSION_USER_MESSAGE, { messageId: "u", text: "x", createdAt: 1 });
    expect(useMessagesStore.getState().bySession).toEqual({});
  });

  test("unknown topics are no-ops", () => {
    routeEvent("totally.made.up.topic", { sessionId: SID });
    expect(useMessagesStore.getState().bySession).toEqual({});
    expect(useNotificationStore.getState().notifications).toEqual([]);
  });

  test("plan.file.changed lands in usePlanStore for the right session", () => {
    routeEvent(EVENT_PLAN_FILE_CHANGED, {
      sessionId: SID,
      path: "/repo/.pi-deck/plans/session-x.md",
      content: "## Plan\n- [ ] step",
    });
    const s = usePlanStore.getState().bySession[SID];
    expect(s?.filePath).toBe("/repo/.pi-deck/plans/session-x.md");
    expect(s?.fileContent).toContain("step");
    expect(s?.panelOpen).toBe(true);
  });

  test("plan.file.changed with null content (file missing) clears the panel auto-open", () => {
    routeEvent(EVENT_PLAN_FILE_CHANGED, {
      sessionId: SID,
      path: "/repo/.pi-deck/plans/session-x.md",
      content: null,
    });
    const s = usePlanStore.getState().bySession[SID];
    expect(s?.fileContent).toBeNull();
    expect(s?.panelOpen).toBe(false);
  });

  test("session.tool.approval.requested attaches pendingApproval to the existing tool call", () => {
    routeEvent(EVENT_SESSION_TOOL_CALL_START, {
      sessionId: SID,
      callId: "t-1",
      name: "write",
      input: { path: "/etc/passwd" },
    });
    routeEvent(EVENT_SESSION_TOOL_APPROVAL_REQUESTED, {
      sessionId: SID,
      approvalId: "appr-1",
      toolCallId: "t-1",
      toolName: "write",
      input: { path: "/etc/passwd" },
      reason: "Outside allowlist",
    });
    const call = useMessagesStore.getState().bySession[SID]?.toolCalls["t-1"];
    expect(call?.pendingApproval?.approvalId).toBe("appr-1");
    expect(call?.pendingApproval?.reason).toBe("Outside allowlist");
    expect(call?.status).toBe("pending");
  });

  test("session.tool.call.end clears pendingApproval (whether allowed or denied)", () => {
    routeEvent(EVENT_SESSION_TOOL_CALL_START, {
      sessionId: SID,
      callId: "t-1",
      name: "write",
      input: { path: "/repo/foo.ts" },
    });
    routeEvent(EVENT_SESSION_TOOL_APPROVAL_REQUESTED, {
      sessionId: SID,
      approvalId: "appr-1",
      toolCallId: "t-1",
      toolName: "write",
      input: { path: "/repo/foo.ts" },
    });
    routeEvent(EVENT_SESSION_TOOL_CALL_END, {
      sessionId: SID,
      callId: "t-1",
      result: { ok: true },
      isError: false,
    });
    const call = useMessagesStore.getState().bySession[SID]?.toolCalls["t-1"];
    expect(call?.pendingApproval).toBeUndefined();
    expect(call?.status).toBe("done");
  });
});
