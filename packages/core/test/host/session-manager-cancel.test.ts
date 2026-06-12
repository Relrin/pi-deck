import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionInfo as PiSessionInfo } from "@earendil-works/pi-coding-agent";
import { MetadataStore } from "../../src/host/metadata-store.js";
import { SessionManager } from "../../src/host/session-manager.js";
import type { WorkerHandle } from "../../src/host/worker-handle.js";
import { EVENT_HOST_ERROR } from "../../src/protocol/events.js";

let tmpDir: string;
let store: MetadataStore;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "pi-deck-cancel-"));
  store = new MetadataStore(tmpDir);
  await store.ensure();
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

interface FakeWorker {
  handle: WorkerHandle;
  kills: string[];
  cancelCalls: number;
}

/**
 * Minimal stand-in for a live WorkerHandle: alive until killed, with a scriptable
 * response to the "cancel" RPC. `request` rejecting models the host-side grace timeout
 * firing (the real timeout lives in WorkerHandle.request).
 */
function makeFakeWorker(cancelBehavior: "resolves" | "rejects"): FakeWorker {
  const state = { alive: true };
  const fake: FakeWorker = {
    kills: [],
    cancelCalls: 0,
    handle: undefined as never,
  };
  fake.handle = {
    get isAlive() {
      return state.alive;
    },
    request: (cmd: string) => {
      if (cmd === "cancel") fake.cancelCalls++;
      return cancelBehavior === "resolves"
        ? Promise.resolve({ ok: true })
        : Promise.reject(new Error("Worker request 'cancel' timed out after 10000ms"));
    },
    kill: (signal: string) => {
      fake.kills.push(signal);
      state.alive = false;
    },
  } as unknown as WorkerHandle;
  return fake;
}

async function makeManagerWithSession(): Promise<{ mgr: SessionManager; sessionId: string }> {
  const project = await store.openOrCreateProject("/work/foo");
  const discovered: PiSessionInfo = {
    path: "/.pi/agent/sessions/foo/abc.jsonl",
    id: "pi-session-abc",
    cwd: "/work/foo",
    created: new Date("2026-05-01T10:00:00Z"),
    modified: new Date("2026-05-10T10:00:00Z"),
    messageCount: 4,
    firstMessage: "hello",
    allMessagesText: "",
  };
  const mgr = new SessionManager({
    spawnWorker: (() => {
      throw new Error("spawnWorker must not be called in these tests");
    }) as never,
    metadataStore: store,
    listPiSessions: async () => [discovered],
  });
  await mgr.rehydrateProject(project.id);
  return { mgr, sessionId: "pi-session-abc" };
}

describe("SessionManager.cancel escalation", () => {
  test("graceful cancel that resolves does not kill the worker", async () => {
    const { mgr, sessionId } = await makeManagerWithSession();
    const fake = makeFakeWorker("resolves");
    const record = mgr.get(sessionId);
    if (!record) throw new Error("missing record");
    record.worker = fake.handle;

    await mgr.cancel(sessionId);

    expect(fake.cancelCalls).toBe(1);
    expect(fake.kills).toEqual([]);
  });

  test("cancel that times out force-kills the worker and emits a host notice", async () => {
    const { mgr, sessionId } = await makeManagerWithSession();
    const fake = makeFakeWorker("rejects");
    const record = mgr.get(sessionId);
    if (!record) throw new Error("missing record");
    record.worker = fake.handle;

    const notices: unknown[] = [];
    mgr.on("event", (topic, payload) => {
      if (topic === EVENT_HOST_ERROR) notices.push(payload);
    });

    await mgr.cancel(sessionId);

    expect(fake.kills).toEqual(["SIGKILL"]);
    expect(notices.length).toBe(1);
    expect(notices[0]).toMatchObject({ sessionId });
  });

  test("cancel is a no-op without a live worker", async () => {
    const { mgr, sessionId } = await makeManagerWithSession();
    // No worker injected — must not throw.
    await mgr.cancel(sessionId);
  });

  test("forceStop kills a live worker outright and is a no-op on a dead one", async () => {
    const { mgr, sessionId } = await makeManagerWithSession();
    const fake = makeFakeWorker("resolves");
    const record = mgr.get(sessionId);
    if (!record) throw new Error("missing record");
    record.worker = fake.handle;

    mgr.forceStop(sessionId);
    expect(fake.kills).toEqual(["SIGKILL"]);

    // Second call: worker reports dead, nothing further happens.
    mgr.forceStop(sessionId);
    expect(fake.kills).toEqual(["SIGKILL"]);
  });
});
