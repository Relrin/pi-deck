import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  __resetSessionWarmup,
  forgetWarmedSession,
  warmMostRecentSession,
  warmSession,
} from "./sessionWarmup";
import { useSessionsStore } from "./useSessionsStore";

function installClient() {
  const call = mock((_method: string, _input: unknown) => Promise.resolve({ ok: true }));
  useSessionsStore.setState((prev) => ({ ...prev, client: { call } as never }));
  return call;
}

function session(id: string, lastActivityAt: string, archived = false) {
  return { id, projectId: "p", title: id, lastActivityAt, archived };
}

beforeEach(() => {
  __resetSessionWarmup();
  useSessionsStore.setState((prev) => ({ ...prev, client: undefined, activeSessionId: undefined }));
});

describe("sessionWarmup — warmSession", () => {
  test("activates the worker via session.activate without touching the UI", () => {
    const call = installClient();
    warmSession("s1");
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0]?.[0]).toBe("session.activate");
    expect(call.mock.calls[0]?.[1]).toEqual({ sessionId: "s1" });
    // It must NOT flip the active session — warming is a background concern.
    expect(useSessionsStore.getState().activeSessionId).toBeUndefined();
  });

  test("dedups repeated warms for the same session", () => {
    const call = installClient();
    warmSession("s1");
    warmSession("s1");
    warmSession("s1");
    expect(call).toHaveBeenCalledTimes(1);
  });

  test("skips the session that's already active", () => {
    const call = installClient();
    useSessionsStore.setState((prev) => ({ ...prev, activeSessionId: "s1" }));
    warmSession("s1");
    expect(call).not.toHaveBeenCalled();
  });

  test("no-ops without a client", () => {
    warmSession("s1");
    // Nothing to assert beyond "did not throw" — there's no client to call.
    expect(useSessionsStore.getState().client).toBeUndefined();
  });

  test("caps the number of prefetch-spawned workers", () => {
    const call = installClient();
    for (let i = 0; i < 9; i++) warmSession(`s${i}`);
    // MAX_WARMED is 6 — extra warms beyond the cap are dropped.
    expect(call).toHaveBeenCalledTimes(6);
  });

  test("forgetWarmedSession lets a session be re-warmed (e.g. after its worker exits)", () => {
    const call = installClient();
    warmSession("s1");
    expect(call).toHaveBeenCalledTimes(1);
    forgetWarmedSession("s1");
    warmSession("s1");
    expect(call).toHaveBeenCalledTimes(2);
  });
});

describe("sessionWarmup — warmMostRecentSession", () => {
  test("warms the most-recent non-archived session, skipping archived + active", () => {
    const call = installClient();
    useSessionsStore.setState((prev) => ({ ...prev, activeSessionId: "active" }));
    warmMostRecentSession([
      session("old", "2026-01-01T00:00:00Z"),
      session("active", "2026-08-01T00:00:00Z"), // newest, but already open → skip
      session("recent", "2026-06-01T00:00:00Z"), // newest eligible
      session("archived-newest", "2026-09-01T00:00:00Z", true), // newer, but archived → skip
    ]);
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0]?.[1]).toEqual({ sessionId: "recent" });
  });

  test("does nothing when every session is archived or active", () => {
    const call = installClient();
    useSessionsStore.setState((prev) => ({ ...prev, activeSessionId: "active" }));
    warmMostRecentSession([
      session("active", "2026-08-01T00:00:00Z"),
      session("arch", "2026-09-01T00:00:00Z", true),
    ]);
    expect(call).not.toHaveBeenCalled();
  });
});
