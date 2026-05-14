import { beforeEach, describe, expect, test } from "bun:test";
import { useMessagesStore } from "./useMessagesStore";

const SID = "session-1";

function reset() {
  useMessagesStore.setState({ bySession: {} });
}

describe("useMessagesStore — user message dedup", () => {
  beforeEach(reset);

  test("appends a user message for a fresh session", () => {
    useMessagesStore.getState().appendUserMessage(SID, {
      messageId: "u-1",
      text: "hi",
      createdAt: 1000,
    });
    const msgs = useMessagesStore.getState().bySession[SID]?.messages ?? [];
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.kind).toBe("user");
  });

  test("dedups by exact id even if text and time differ", () => {
    useMessagesStore
      .getState()
      .appendUserMessage(SID, { messageId: "u-1", text: "hi", createdAt: 1000 });
    useMessagesStore
      .getState()
      .appendUserMessage(SID, { messageId: "u-1", text: "different", createdAt: 99999 });
    expect(useMessagesStore.getState().bySession[SID]?.messages.length).toBe(1);
  });

  test("dedups by same text within the 10s window", () => {
    useMessagesStore
      .getState()
      .appendUserMessage(SID, { messageId: "u-local", text: "hello", createdAt: 1000 });
    useMessagesStore
      .getState()
      .appendUserMessage(SID, { messageId: "u-server", text: "hello", createdAt: 5000 });
    expect(useMessagesStore.getState().bySession[SID]?.messages.length).toBe(1);
  });

  test("does NOT dedup when the same text is well outside the window", () => {
    useMessagesStore
      .getState()
      .appendUserMessage(SID, { messageId: "u-1", text: "hello", createdAt: 1000 });
    useMessagesStore
      .getState()
      .appendUserMessage(SID, { messageId: "u-2", text: "hello", createdAt: 1000 + 60_000 });
    expect(useMessagesStore.getState().bySession[SID]?.messages.length).toBe(2);
  });
});

describe("useMessagesStore — assistant deltas", () => {
  beforeEach(reset);

  function delta(text: string, timestamp: number) {
    return {
      timestamp,
      content: [{ type: "text", text }],
    };
  }

  test("first delta creates an assistant entry seeded from the snapshot", () => {
    useMessagesStore.getState().appendAssistantDelta(SID, {}, delta("Hello", 100));
    const msgs = useMessagesStore.getState().bySession[SID]?.messages ?? [];
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.kind).toBe("assistant");
    if (msgs[0]?.kind !== "assistant") throw new Error("not assistant");
    expect(msgs[0].text).toBe("Hello");
    expect(msgs[0].isComplete).toBe(false);
  });

  test("subsequent deltas replace the snapshot (no duplication on replay)", () => {
    useMessagesStore.getState().appendAssistantDelta(SID, {}, delta("Hel", 100));
    useMessagesStore.getState().appendAssistantDelta(SID, {}, delta("Hello", 100));
    useMessagesStore.getState().appendAssistantDelta(SID, {}, delta("Hello world", 100));
    const msgs = useMessagesStore.getState().bySession[SID]?.messages ?? [];
    expect(msgs).toHaveLength(1);
    if (msgs[0]?.kind !== "assistant") throw new Error("not assistant");
    expect(msgs[0].text).toBe("Hello world");
  });

  test("a delta with a new remoteTimestamp replaces the stale incomplete bubble", () => {
    useMessagesStore.getState().appendAssistantDelta(SID, {}, delta("attempt 1", 100));
    useMessagesStore.getState().appendAssistantDelta(SID, {}, delta("attempt 2", 200));
    const msgs = useMessagesStore.getState().bySession[SID]?.messages ?? [];
    expect(msgs).toHaveLength(1);
    if (msgs[0]?.kind !== "assistant") throw new Error("not assistant");
    expect(msgs[0].text).toBe("attempt 2");
  });

  test("endTurn marks the assistant complete", () => {
    useMessagesStore.getState().appendAssistantDelta(SID, {}, delta("done", 100));
    useMessagesStore.getState().endTurn(SID, false);
    const msgs = useMessagesStore.getState().bySession[SID]?.messages ?? [];
    if (msgs[0]?.kind !== "assistant") throw new Error("not assistant");
    expect(msgs[0].isComplete).toBe(true);
    expect(useMessagesStore.getState().bySession[SID]?.isTurnInFlight).toBe(false);
  });

  test("a late delta after endTurn updates the existing bubble (no duplicate)", () => {
    useMessagesStore.getState().appendAssistantDelta(SID, {}, delta("partial", 100));
    useMessagesStore.getState().endTurn(SID, false);
    // Late delta — same remoteTimestamp, full final text.
    useMessagesStore.getState().appendAssistantDelta(SID, {}, delta("partial final", 100));
    const msgs = useMessagesStore.getState().bySession[SID]?.messages ?? [];
    const assistants = msgs.filter((m) => m.kind === "assistant");
    expect(assistants).toHaveLength(1);
    if (assistants[0]?.kind !== "assistant") throw new Error("not assistant");
    expect(assistants[0].text).toBe("partial final");
    expect(assistants[0].isComplete).toBe(true);
    // The turn has already ended — a late delta must not re-arm "in flight".
    expect(useMessagesStore.getState().bySession[SID]?.isTurnInFlight).toBe(false);
  });

  test("a delta after endTurn with a NEW remoteTimestamp creates a second assistant", () => {
    useMessagesStore.getState().appendAssistantDelta(SID, {}, delta("first turn", 100));
    useMessagesStore.getState().endTurn(SID, false);
    useMessagesStore.getState().appendAssistantDelta(SID, {}, delta("second turn", 200));
    const assistants = (useMessagesStore.getState().bySession[SID]?.messages ?? []).filter(
      (m) => m.kind === "assistant",
    );
    expect(assistants).toHaveLength(2);
    if (assistants[1]?.kind !== "assistant") throw new Error("not assistant");
    expect(assistants[1].text).toBe("second turn");
  });
});

describe("useMessagesStore — tool calls", () => {
  beforeEach(reset);

  test("start adds a tool call in running state and attaches its id to the assistant", () => {
    useMessagesStore.getState().applyToolCallStart(SID, {
      callId: "t-1",
      name: "bash",
      input: { command: "ls" },
    });
    const session = useMessagesStore.getState().bySession[SID];
    expect(session?.toolCalls["t-1"]?.status).toBe("running");
    const last = session?.messages.at(-1);
    if (last?.kind !== "assistant") throw new Error("expected assistant");
    expect(last.toolCallIds).toContain("t-1");
  });

  test("partial result accumulates in the tool call entry", () => {
    useMessagesStore.getState().applyToolCallStart(SID, {
      callId: "t-1",
      name: "bash",
      input: { command: "echo" },
    });
    useMessagesStore.getState().applyToolCallUpdate(SID, {
      callId: "t-1",
      partialResult: "streaming…",
    });
    expect(useMessagesStore.getState().bySession[SID]?.toolCalls["t-1"]?.partialResult).toBe(
      "streaming…",
    );
  });

  test("end with isError=false flips status to done with result", () => {
    useMessagesStore.getState().applyToolCallStart(SID, {
      callId: "t-1",
      name: "bash",
      input: { command: "echo" },
    });
    useMessagesStore.getState().applyToolCallEnd(SID, {
      callId: "t-1",
      result: "hi",
      isError: false,
    });
    const call = useMessagesStore.getState().bySession[SID]?.toolCalls["t-1"];
    expect(call?.status).toBe("done");
    expect(call?.result).toBe("hi");
  });

  test("end with isError=true flips status to error and extracts errorText", () => {
    useMessagesStore.getState().applyToolCallStart(SID, {
      callId: "t-1",
      name: "bash",
      input: {},
    });
    useMessagesStore.getState().applyToolCallEnd(SID, {
      callId: "t-1",
      result: { message: "permission denied" },
      isError: true,
    });
    const call = useMessagesStore.getState().bySession[SID]?.toolCalls["t-1"];
    expect(call?.status).toBe("error");
    expect(call?.errorText).toBe("permission denied");
  });

  test("endTurn(cancelled) flips running/pending calls to cancelled, leaves done alone", () => {
    useMessagesStore
      .getState()
      .applyToolCallStart(SID, { callId: "running", name: "bash", input: {} });
    useMessagesStore
      .getState()
      .applyToolCallStart(SID, { callId: "done", name: "bash", input: {} });
    useMessagesStore
      .getState()
      .applyToolCallEnd(SID, { callId: "done", result: "ok", isError: false });
    useMessagesStore.getState().endTurn(SID, true);
    const tc = useMessagesStore.getState().bySession[SID]?.toolCalls;
    expect(tc?.running?.status).toBe("cancelled");
    expect(tc?.done?.status).toBe("done");
  });
});

describe("useMessagesStore — session isolation", () => {
  beforeEach(reset);

  test("clearing one session doesn't affect another", () => {
    useMessagesStore
      .getState()
      .appendUserMessage("a", { messageId: "ua", text: "hi", createdAt: 1 });
    useMessagesStore
      .getState()
      .appendUserMessage("b", { messageId: "ub", text: "bye", createdAt: 1 });
    useMessagesStore.getState().clearSession("a");
    expect(useMessagesStore.getState().bySession.a).toBeUndefined();
    expect(useMessagesStore.getState().bySession.b?.messages.length).toBe(1);
  });
});
