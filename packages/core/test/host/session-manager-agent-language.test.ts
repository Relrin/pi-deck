import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionInfo as PiSessionInfo } from "@earendil-works/pi-coding-agent";
import { MetadataStore } from "../../src/host/metadata-store.js";
import { SessionManager } from "../../src/host/session-manager.js";
import type { WorkerHandle } from "../../src/host/worker-handle.js";

/**
 * `session.setAgentLanguage` is the only channel that carries the agent's language to the host —
 * there is no global-default command — so the renderer fans the one Settings preference out to
 * every session. These cover the part of that contract the host owns.
 */

let tmpDir: string;
let store: MetadataStore;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "pi-deck-agent-lang-"));
  store = new MetadataStore(tmpDir);
  await store.ensure();
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

interface FakeWorker {
  handle: WorkerHandle;
  languageCalls: string[];
}

/** Records the locale handed to each `setAgentLanguage` RPC. */
function makeFakeWorker(): FakeWorker {
  const fake: FakeWorker = { languageCalls: [], handle: undefined as never };
  fake.handle = {
    get isAlive() {
      return true;
    },
    request: (cmd: string, params?: { locale?: string }) => {
      if (cmd === "setAgentLanguage" && params?.locale) fake.languageCalls.push(params.locale);
      return Promise.resolve({ ok: true });
    },
    kill: () => {},
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

describe("SessionManager.setAgentLanguage", () => {
  test("hands the worker a concrete locale, resolving `match-ui` against the interface", async () => {
    const { mgr, sessionId } = await makeManagerWithSession();
    const fake = makeFakeWorker();
    const record = mgr.get(sessionId);
    if (!record) throw new Error("missing record");
    record.worker = fake.handle;

    await mgr.setAgentLanguage(sessionId, "match-ui", "ru");

    expect(fake.languageCalls).toEqual(["ru"]);
    expect(record.agentLanguage).toBe("match-ui");
  });

  test("an explicit language wins over the interface locale", async () => {
    const { mgr, sessionId } = await makeManagerWithSession();
    const fake = makeFakeWorker();
    const record = mgr.get(sessionId);
    if (!record) throw new Error("missing record");
    record.worker = fake.handle;

    await mgr.setAgentLanguage(sessionId, "en", "ru");

    expect(fake.languageCalls).toEqual(["en"]);
  });

  test("switching the interface locale still reaches the worker while the preference is `match-ui`", async () => {
    // The regression this guards: comparing only `language` made this a no-op, so a user who left
    // the agent on "Match interface" and switched the UI to Russian kept getting English.
    const { mgr, sessionId } = await makeManagerWithSession();
    const fake = makeFakeWorker();
    const record = mgr.get(sessionId);
    if (!record) throw new Error("missing record");
    record.worker = fake.handle;

    await mgr.setAgentLanguage(sessionId, "match-ui", "en");
    await mgr.setAgentLanguage(sessionId, "match-ui", "ru");

    expect(fake.languageCalls).toEqual(["en", "ru"]);
  });

  test("a genuinely unchanged pair is still a no-op", async () => {
    const { mgr, sessionId } = await makeManagerWithSession();
    const fake = makeFakeWorker();
    const record = mgr.get(sessionId);
    if (!record) throw new Error("missing record");
    record.worker = fake.handle;

    await mgr.setAgentLanguage(sessionId, "match-ui", "ru");
    await mgr.setAgentLanguage(sessionId, "match-ui", "ru");

    expect(fake.languageCalls).toEqual(["ru"]);
  });

  test("persists the preference so a dormant session picks it up on its next activate", async () => {
    const { mgr, sessionId } = await makeManagerWithSession();
    // No worker: the record and its metadata must still be updated.
    await mgr.setAgentLanguage(sessionId, "ru", "en");

    expect(mgr.get(sessionId)?.agentLanguage).toBe("ru");
    expect(mgr.get(sessionId)?.uiLocale).toBe("en");
  });
});
