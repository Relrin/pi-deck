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
import { useToastStore } from "../../features/_status/useToastStore.js";
import { useMessagesStore } from "../../features/chat/useMessagesStore.js";

type Payload = Record<string, unknown>;

function asPayload(p: unknown): Payload {
  return typeof p === "object" && p !== null ? (p as Payload) : {};
}

export function routeEvent(topic: string, rawPayload: unknown): void {
  const payload = asPayload(rawPayload);
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
      return;
    }
    case EVENT_SESSION_WORKER_EXIT: {
      useMessagesStore.getState().markTurnInFlight(sessionId, false);
      return;
    }
    case EVENT_SESSION_AGENT_EVENT: {
      // The bridge forwards every pi event raw; surface prompt errors as toasts so the user
      // sees auth/model/config failures instead of a silent "Stop" button.
      const event = payload.event as { type?: string; message?: string } | undefined;
      if (event?.type === "prompt_error") {
        useToastStore.getState().push(event.message ?? "pi reported a prompt error", "error");
        useMessagesStore.getState().markTurnInFlight(sessionId, false);
      }
      return;
    }
    case EVENT_HOST_ERROR: {
      const msg = typeof payload.message === "string" ? payload.message : "Host error";
      useToastStore.getState().push(msg, "error");
      return;
    }
    default:
      return;
  }
}
