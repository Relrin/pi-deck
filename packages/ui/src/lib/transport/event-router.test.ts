import { beforeEach, describe, expect, test } from "bun:test";
import {
  EVENT_HOST_ERROR,
  EVENT_SESSION_AGENT_EVENT,
  EVENT_SESSION_MESSAGE_DELTA,
  EVENT_SESSION_TOOL_CALL_END,
  EVENT_SESSION_TOOL_CALL_START,
  EVENT_SESSION_TOOL_CALL_UPDATE,
  EVENT_SESSION_TURN_END,
  EVENT_SESSION_USER_MESSAGE,
  EVENT_SESSION_WORKER_EXIT,
} from "@pi-deck/core/protocol/events.js";
import { useToastStore } from "../../features/_status/useToastStore";
import { useMessagesStore } from "../../features/chat/useMessagesStore";
import { useUsageStore } from "../../features/chat/useUsageStore";
import { routeEvent } from "./event-router";

const SID = "session-x";

beforeEach(() => {
  useMessagesStore.setState({ bySession: {} });
  useToastStore.setState({ toasts: [] });
  useUsageStore.setState({ bySession: {} });
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

  test("worker exit clears the in-flight flag", () => {
    useMessagesStore.getState().markTurnInFlight(SID, true);
    routeEvent(EVENT_SESSION_WORKER_EXIT, { sessionId: SID, code: 1, signal: null });
    expect(useMessagesStore.getState().bySession[SID]?.isTurnInFlight).toBe(false);
  });

  test("agent prompt_error surfaces a toast and clears in-flight", () => {
    useMessagesStore.getState().markTurnInFlight(SID, true);
    routeEvent(EVENT_SESSION_AGENT_EVENT, {
      sessionId: SID,
      event: { type: "prompt_error", message: "auth failed" },
    });
    expect(useToastStore.getState().toasts.length).toBe(1);
    expect(useToastStore.getState().toasts[0]?.kind).toBe("error");
    expect(useMessagesStore.getState().bySession[SID]?.isTurnInFlight).toBe(false);
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

  test("host error surfaces a toast", () => {
    routeEvent(EVENT_HOST_ERROR, { message: "transport failed" });
    expect(useToastStore.getState().toasts[0]?.message).toBe("transport failed");
  });

  test("events without sessionId are ignored (except host error)", () => {
    routeEvent(EVENT_SESSION_USER_MESSAGE, { messageId: "u", text: "x", createdAt: 1 });
    expect(useMessagesStore.getState().bySession).toEqual({});
  });

  test("unknown topics are no-ops", () => {
    routeEvent("totally.made.up.topic", { sessionId: SID });
    expect(useMessagesStore.getState().bySession).toEqual({});
    expect(useToastStore.getState().toasts).toEqual([]);
  });
});
