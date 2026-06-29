import { beforeEach, describe, expect, test } from "bun:test";
import { useComposerStore } from "../../../src/features/chat/composer/useComposerStore";
import type { ToolCallEntry } from "../../../src/features/chat/types";
import {
  selectSessionLoaded,
  selectSessionRailStatus,
  useMessagesStore,
} from "../../../src/features/chat/useMessagesStore";

const SID = "session-1";

function reset() {
  useMessagesStore.setState({ bySession: {} });
  useComposerStore.setState({ bySession: {} });
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

  test("stamps agentModeAtTurn from the composer store at bubble creation", () => {
    // Composer flipped to plan mode before the agent's first delta arrives.
    useComposerStore.setState({ bySession: { [SID]: "plan" } });
    useMessagesStore.getState().appendAssistantDelta(SID, {}, delta("- [ ] step", 100));
    const msgs = useMessagesStore.getState().bySession[SID]?.messages ?? [];
    if (msgs[0]?.kind !== "assistant") throw new Error("not assistant");
    expect(msgs[0].agentModeAtTurn).toBe("plan");
  });

  test("stamps agentModeAtTurn on a tool-call-first turn (no text delta yet)", () => {
    useComposerStore.setState({ bySession: { [SID]: "ask" } });
    useMessagesStore.getState().applyToolCallStart(SID, {
      callId: "t-1",
      name: "read",
      input: { path: "/repo/x.ts" },
    });
    const msgs = useMessagesStore.getState().bySession[SID]?.messages ?? [];
    if (msgs[0]?.kind !== "assistant") throw new Error("not assistant");
    expect(msgs[0].agentModeAtTurn).toBe("ask");
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

  test("update backfills the name when start arrived with an empty one", () => {
    // Pi sometimes opens a call with `toolName: ""` (XML-style examples in plan-mode
    // text get tentatively parsed). The real name lands on a later update/end — when it
    // does, the entry should pick it up so the row is no longer a nameless ghost.
    useMessagesStore.getState().applyToolCallStart(SID, {
      callId: "t-1",
      name: "",
      input: undefined,
    });
    useMessagesStore.getState().applyToolCallUpdate(SID, {
      callId: "t-1",
      name: "bash",
      partialResult: undefined,
    });
    expect(useMessagesStore.getState().bySession[SID]?.toolCalls["t-1"]?.name).toBe("bash");
  });

  test("end backfills the name when start arrived with an empty one", () => {
    useMessagesStore.getState().applyToolCallStart(SID, {
      callId: "t-1",
      name: "",
      input: undefined,
    });
    useMessagesStore.getState().applyToolCallEnd(SID, {
      callId: "t-1",
      name: "bash",
      result: "done",
      isError: false,
    });
    expect(useMessagesStore.getState().bySession[SID]?.toolCalls["t-1"]?.name).toBe("bash");
  });

  test("update does not overwrite an existing name with a later differing value", () => {
    // Defensive: once a name is set, it's authoritative. A racing later event with a
    // different name should be ignored so the row label doesn't flicker.
    useMessagesStore.getState().applyToolCallStart(SID, {
      callId: "t-1",
      name: "bash",
      input: {},
    });
    useMessagesStore.getState().applyToolCallUpdate(SID, {
      callId: "t-1",
      name: "edit",
      partialResult: undefined,
    });
    expect(useMessagesStore.getState().bySession[SID]?.toolCalls["t-1"]?.name).toBe("bash");
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

describe("useMessagesStore — tool-call replay dedup", () => {
  beforeEach(reset);

  test("a replayed tool_execution_start for an already-attached callId is a no-op (no second bubble, no double render)", () => {
    // Turn 1: assistant text + a tool call attached to it.
    useMessagesStore.getState().appendAssistantDelta(
      SID,
      {},
      {
        content: [{ type: "text", text: "running it" }],
        model: "claude-sonnet-4-5",
        timestamp: 1_000,
      },
    );
    useMessagesStore
      .getState()
      .applyToolCallStart(SID, { callId: "abc", name: "write", input: { path: "x" } });
    useMessagesStore
      .getState()
      .applyToolCallEnd(SID, { callId: "abc", result: "ok", isError: false });
    useMessagesStore.getState().endTurn(SID, undefined);

    const beforeReplay = useMessagesStore.getState().bySession[SID];
    const entryBefore = beforeReplay?.toolCalls.abc;
    expect(entryBefore?.status).toBe("done");

    // Turn 2 opens with a replayed `tool_execution_start` for the SAME callId — pi can
    // do this when the previous turn's history is rolled into the new turn's context.
    useMessagesStore
      .getState()
      .applyToolCallStart(SID, { callId: "abc", name: "write", input: { path: "x" } });

    const afterReplay = useMessagesStore.getState().bySession[SID];
    // Still exactly one assistant bubble (no orphan continuation created for the dup).
    expect(afterReplay?.messages.filter((m) => m.kind === "assistant")).toHaveLength(1);
    // The single bubble carries `abc` exactly once.
    const onlyAssistant = afterReplay?.messages.find((m) => m.kind === "assistant");
    if (onlyAssistant?.kind !== "assistant") throw new Error("expected assistant");
    expect(onlyAssistant.toolCallIds.filter((id) => id === "abc")).toHaveLength(1);
    // And the entry's terminal status is preserved — we don't reset it back to "running".
    expect(afterReplay?.toolCalls.abc?.status).toBe("done");
  });
});

describe("useMessagesStore — model carry-over across turns", () => {
  beforeEach(reset);

  test("tool-only continuation bubble inherits the previous turn's model", () => {
    // Turn 1: assistant streams text + model — captured from the snapshot.
    useMessagesStore.getState().appendAssistantDelta(
      SID,
      {},
      {
        content: [{ type: "text", text: "Let me look." }],
        model: "claude-sonnet-4-5",
        timestamp: 1_000,
      },
    );
    useMessagesStore.getState().endTurn(SID, undefined);

    // Turn 2 opens with a tool call BEFORE any text delta — this used to create a
    // model-less bubble that rendered as the generic "pi" label.
    useMessagesStore.getState().applyToolCallStart(SID, { callId: "t1", name: "bash", input: {} });

    const messages = useMessagesStore.getState().bySession[SID]?.messages ?? [];
    const continuation = messages[messages.length - 1];
    expect(continuation?.kind).toBe("assistant");
    if (continuation?.kind !== "assistant") throw new Error("unreachable");
    expect(continuation.model).toBe("claude-sonnet-4-5");
  });

  test("a later assistant delta still wins over the carried-forward model", () => {
    useMessagesStore.getState().appendAssistantDelta(
      SID,
      {},
      {
        content: [{ type: "text", text: "" }],
        model: "claude-sonnet-4-5",
        timestamp: 1_000,
      },
    );
    useMessagesStore.getState().endTurn(SID, undefined);
    useMessagesStore.getState().applyToolCallStart(SID, { callId: "t1", name: "bash", input: {} });
    // Now the actual text delta arrives, reporting a different model.
    useMessagesStore.getState().appendAssistantDelta(
      SID,
      {},
      {
        content: [{ type: "text", text: "Switching models." }],
        model: "kimi-k2-5",
        timestamp: 2_000,
      },
    );
    const messages = useMessagesStore.getState().bySession[SID]?.messages ?? [];
    const last = messages[messages.length - 1];
    expect(last?.kind).toBe("assistant");
    if (last?.kind !== "assistant") throw new Error("unreachable");
    expect(last.model).toBe("kimi-k2-5");
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

describe("useMessagesStore — loadHistory", () => {
  beforeEach(reset);

  test("replaces the session's messages + toolCalls with the snapshot", () => {
    useMessagesStore
      .getState()
      .appendUserMessage(SID, { messageId: "stale", text: "stale", createdAt: 1 });
    useMessagesStore.getState().loadHistory(SID, {
      messages: [
        { kind: "user", id: "u-hist", text: "old prompt", createdAt: 100 },
        {
          kind: "assistant",
          id: "a-hist",
          text: "old reply",
          isComplete: true,
          toolCallIds: [],
          createdAt: 200,
        },
      ],
      toolCalls: {},
    });
    const session = useMessagesStore.getState().bySession[SID];
    expect(session?.messages.map((m) => m.id)).toEqual(["u-hist", "a-hist"]);
    expect(session?.isTurnInFlight).toBe(false);
  });

  test("new assistant delta after loadHistory APPENDS instead of overwriting the historical reply", () => {
    // Regression: when the worker forgets `isComplete`, the historical assistant message
    // matches `lastIncompleteAssistantIdx` and the next streamed delta replaces its text —
    // user perceives "talking to themselves" because their old bot answer becomes the new
    // bot answer. loadHistory must defensively force `isComplete: true`.
    const historicalAssistant = {
      kind: "assistant" as const,
      id: "a-hist",
      // Simulate a wire payload that forgot the flag; the store should patch it.
      text: "preserved historical reply",
      toolCallIds: [],
      createdAt: 200,
    };
    // Cast through `unknown` so the test can pass an ill-formed assistant entry
    // (missing `isComplete`) to validate the defensive fill in `loadHistory`.
    type LoadHistoryArg = Parameters<
      ReturnType<typeof useMessagesStore.getState>["loadHistory"]
    >[1];
    useMessagesStore.getState().loadHistory(SID, {
      messages: [
        { kind: "user", id: "u-hist", text: "old prompt", createdAt: 100 },
        historicalAssistant,
      ] as unknown as LoadHistoryArg["messages"],
      toolCalls: {},
    });

    // A live streamed assistant reply arrives.
    useMessagesStore
      .getState()
      .appendUserMessage(SID, { messageId: "u-live", text: "new prompt", createdAt: 1000 });
    useMessagesStore.getState().appendAssistantDelta(
      SID,
      {},
      {
        role: "assistant",
        content: [{ type: "text", text: "fresh reply" }],
        timestamp: 2000,
      },
    );

    const msgs = useMessagesStore.getState().bySession[SID]?.messages ?? [];
    expect(msgs).toHaveLength(4);
    expect(msgs[1]?.kind).toBe("assistant");
    expect((msgs[1] as { text: string }).text).toBe("preserved historical reply");
    expect((msgs[1] as { isComplete?: boolean }).isComplete).toBe(true);
    expect(msgs[3]?.kind).toBe("assistant");
    expect((msgs[3] as { text: string }).text).toBe("fresh reply");
  });
});

describe("useMessagesStore — selectSessionLoaded", () => {
  test("false before history loads, true once loadHistory seeds the session (even if empty)", () => {
    reset();
    expect(selectSessionLoaded(SID)(useMessagesStore.getState())).toBe(false);
    useMessagesStore.getState().loadHistory(SID, { messages: [], toolCalls: {} });
    expect(selectSessionLoaded(SID)(useMessagesStore.getState())).toBe(true);
  });

  test("false for an undefined session id", () => {
    expect(selectSessionLoaded(undefined)(useMessagesStore.getState())).toBe(false);
  });
});

describe("useMessagesStore — turn outcome lifecycle", () => {
  beforeEach(reset);

  test("endTurn(false) records an 'ok' outcome, unviewed", () => {
    useMessagesStore.getState().markTurnInFlight(SID, true);
    useMessagesStore.getState().endTurn(SID, false);
    const s = useMessagesStore.getState().bySession[SID];
    expect(s?.lastOutcome).toBe("ok");
    expect(s?.outcomeViewed).toBe(false);
    expect(s?.isTurnInFlight).toBe(false);
  });

  test("endTurn(true) records a 'failed' outcome", () => {
    useMessagesStore.getState().markTurnInFlight(SID, true);
    useMessagesStore.getState().endTurn(SID, true);
    expect(useMessagesStore.getState().bySession[SID]?.lastOutcome).toBe("failed");
  });

  test("markTurnFailed records 'failed' only while a turn is in flight", () => {
    useMessagesStore.getState().markTurnInFlight(SID, true);
    useMessagesStore.getState().markTurnFailed(SID);
    let s = useMessagesStore.getState().bySession[SID];
    expect(s?.lastOutcome).toBe("failed");
    expect(s?.isTurnInFlight).toBe(false);

    // A second call with nothing in flight is a no-op — it must not stomp a later 'ok' outcome.
    useMessagesStore.getState().markTurnInFlight(SID, true);
    useMessagesStore.getState().endTurn(SID, false);
    useMessagesStore.getState().markTurnFailed(SID);
    s = useMessagesStore.getState().bySession[SID];
    expect(s?.lastOutcome).toBe("ok");
  });

  test("starting a new turn clears the prior outcome", () => {
    useMessagesStore.getState().markTurnInFlight(SID, true);
    useMessagesStore.getState().endTurn(SID, false);
    useMessagesStore.getState().markTurnInFlight(SID, true);
    const s = useMessagesStore.getState().bySession[SID];
    expect(s?.lastOutcome).toBeUndefined();
    expect(s?.outcomeViewed).toBe(false);
  });

  test("markViewed flips outcomeViewed and is idempotent / safe on a missing session", () => {
    useMessagesStore.getState().markViewed("ghost"); // no entry — no throw, no entry created
    expect(useMessagesStore.getState().bySession.ghost).toBeUndefined();

    useMessagesStore.getState().markTurnInFlight(SID, true);
    useMessagesStore.getState().endTurn(SID, false);
    useMessagesStore.getState().markViewed(SID);
    expect(useMessagesStore.getState().bySession[SID]?.outcomeViewed).toBe(true);
  });
});

describe("useMessagesStore — selectSessionRailStatus", () => {
  beforeEach(reset);

  const read = (sid: string) => selectSessionRailStatus(sid)(useMessagesStore.getState());

  type SeedPatch = {
    isTurnInFlight?: boolean;
    toolCalls?: Record<string, ToolCallEntry>;
    lastOutcome?: "ok" | "failed";
    outcomeViewed?: boolean;
  };

  function seed(sid: string, partial: SeedPatch) {
    useMessagesStore.setState((state) => ({
      bySession: {
        ...state.bySession,
        [sid]: { messages: [], toolCalls: {}, isTurnInFlight: false, ...partial },
      },
    }));
  }

  const approvalCall: ToolCallEntry = {
    id: "t1",
    name: "shell",
    input: {},
    status: "pending",
    startedAt: 0,
    pendingApproval: { approvalId: "a1" },
  };

  test("idle for unknown / empty sessions", () => {
    expect(read("nope")).toBe("idle");
    seed(SID, {});
    expect(read(SID)).toBe("idle");
  });

  test("working while a turn is in flight", () => {
    seed(SID, { isTurnInFlight: true });
    expect(read(SID)).toBe("working");
  });

  test("waiting outranks working when an approval/ask is pending", () => {
    seed(SID, { isTurnInFlight: true, toolCalls: { t1: approvalCall } });
    expect(read(SID)).toBe("waiting");
  });

  test("failed and done only show while unviewed", () => {
    seed(SID, { lastOutcome: "failed", outcomeViewed: false });
    expect(read(SID)).toBe("failed");
    seed(SID, { lastOutcome: "ok", outcomeViewed: false });
    expect(read(SID)).toBe("done");
    seed(SID, { lastOutcome: "ok", outcomeViewed: true });
    expect(read(SID)).toBe("idle");
  });
});
