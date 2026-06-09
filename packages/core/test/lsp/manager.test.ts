import { describe, expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import {
  createMessageConnection,
  type MessageConnection,
  ResponseError,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-jsonrpc/node";
import type { LspDetectionDeps } from "../../src/lsp/environment.js";
import {
  LanguageServerManager,
  LspManagerError,
  type SpawnedServer,
} from "../../src/lsp/manager.js";
import type { EventTopic } from "../../src/protocol/events.js";

const REQUEST_CANCELLED = -32800;

/** An in-process language server: real vscode-jsonrpc over PassThrough stdio. */
interface FakeServer {
  spawned: SpawnedServer;
  conn: MessageConnection;
  requests: Array<{ method: string; params: unknown }>;
  notifications: Array<{ method: string; params: unknown }>;
  killed: boolean;
  /** Simulate the process exiting on its own. */
  exit: (code: number | null) => void;
}

function makeFakeServer(): FakeServer {
  const toServer = new PassThrough();
  const fromServer = new PassThrough();
  const conn = createMessageConnection(
    new StreamMessageReader(toServer),
    new StreamMessageWriter(fromServer),
  );
  let exitCb: (code: number | null) => void = () => {};
  const fake: FakeServer = {
    conn,
    requests: [],
    notifications: [],
    killed: false,
    exit: (code) => exitCb(code),
    spawned: {
      pid: 4242,
      stdin: toServer,
      stdout: fromServer,
      onExit: (cb) => {
        exitCb = cb;
      },
      kill: () => {
        fake.killed = true;
      },
    },
  };
  conn.onRequest((method, params, token) => {
    fake.requests.push({ method, params });
    if (method === "initialize") return { capabilities: { hoverProvider: true } };
    if (method === "shutdown") return null;
    if (method === "textDocument/hover") {
      // Hang until cancelled so the $/cancelRequest interception can be observed.
      return new Promise((_resolve, reject) => {
        token.onCancellationRequested(() => {
          reject(new ResponseError(REQUEST_CANCELLED, "cancelled"));
        });
      });
    }
    return { echoed: method };
  });
  conn.onNotification((method, params) => {
    fake.notifications.push({ method, params });
  });
  conn.listen();
  return fake;
}

interface Harness {
  manager: LanguageServerManager;
  fakes: FakeServer[];
  events: Array<{ topic: EventTopic; payload: unknown }>;
}

function makeHarness(options: { available?: boolean; idleShutdownMs?: number } = {}): Harness {
  const fakes: FakeServer[] = [];
  const detectionDeps: Partial<LspDetectionDeps> = {
    platform: "linux",
    env: {} as NodeJS.ProcessEnv,
    whichLocal: async () => (options.available === false ? null : "/usr/bin/fake-server"),
    existsInWsl: async () => false,
  };
  const manager = new LanguageServerManager({
    detectionDeps,
    idleShutdownMs: options.idleShutdownMs,
    spawnServer: () => {
      const fake = makeFakeServer();
      fakes.push(fake);
      return fake.spawned;
    },
  });
  const events: Harness["events"] = [];
  manager.on("event", (topic, payload) => events.push({ topic, payload }));
  return { manager, fakes, events };
}

const ENSURE_TS = { projectId: "p1", projectRoot: "/home/u/proj", languageId: "typescript" };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("LanguageServerManager.ensure", () => {
  test("spawns once per (project, server) and reuses the entry", async () => {
    const h = makeHarness();
    const first = await h.manager.ensure(ENSURE_TS);
    const second = await h.manager.ensure({ ...ENSURE_TS, languageId: "javascript" });
    expect(first).toEqual({
      status: "running",
      key: "p1:typescript",
      serverId: "typescript",
      rootUri: "file:///home/u/proj",
      mapping: { kind: "local" },
    });
    expect(second).toEqual(first);
    expect(h.fakes).toHaveLength(1);
    h.manager.shutdownAll();
  });

  test("unknown language is unsupported; missing binary reports the install hint", async () => {
    const h = makeHarness({ available: false });
    expect(await h.manager.ensure({ ...ENSURE_TS, languageId: "cobol" })).toEqual({
      status: "unsupported",
    });
    const missing = await h.manager.ensure(ENSURE_TS);
    expect(missing).toEqual({
      status: "missing",
      serverId: "typescript",
      installHint: "npm install -g typescript-language-server typescript",
    });
    expect(h.fakes).toHaveLength(0);
  });
});

describe("LanguageServerManager.request", () => {
  test("rewrites initialize params to pin the root", async () => {
    const h = makeHarness();
    await h.manager.ensure(ENSURE_TS);
    const res = await h.manager.request({
      key: "p1:typescript",
      method: "initialize",
      params: { rootUri: "file:///somewhere/evil", capabilities: { textDocument: {} } },
      clientRequestId: 1,
    });
    expect(res).toEqual({ result: { capabilities: { hoverProvider: true } } });
    const init = h.fakes[0]?.requests[0];
    expect(init?.method).toBe("initialize");
    const params = init?.params as Record<string, unknown>;
    expect(params.rootUri).toBe("file:///home/u/proj");
    expect(params.workspaceFolders).toEqual([{ uri: "file:///home/u/proj", name: "proj" }]);
    expect(params.capabilities).toEqual({ textDocument: {} });
    h.manager.shutdownAll();
  });

  test("re-initialize after a renderer reload restarts the process under the same key", async () => {
    const h = makeHarness();
    await h.manager.ensure(ENSURE_TS);
    await h.manager.request({
      key: "p1:typescript",
      method: "initialize",
      params: {},
      clientRequestId: 1,
    });
    expect(h.fakes).toHaveLength(1);
    const res = await h.manager.request({
      key: "p1:typescript",
      method: "initialize",
      params: {},
      clientRequestId: 2,
    });
    expect(res).toEqual({ result: { capabilities: { hoverProvider: true } } });
    expect(h.fakes).toHaveLength(2);
    expect(h.fakes[0]?.killed).toBe(true);
    // The old process's exit must not be misreported as a crash.
    h.fakes[0]?.exit(1);
    await sleep(10);
    const crashes = h.events.filter(
      (e) =>
        e.topic === "lsp.serverStatus" && (e.payload as { status: string }).status === "crashed",
    );
    expect(crashes).toHaveLength(0);
    h.manager.shutdownAll();
  });

  test("non-allowlisted methods are rejected", async () => {
    const h = makeHarness();
    await h.manager.ensure(ENSURE_TS);
    expect(
      h.manager.request({
        key: "p1:typescript",
        method: "workspace/executeCommand",
        params: {},
        clientRequestId: 3,
      }),
    ).rejects.toThrow(LspManagerError);
    expect(() =>
      h.manager.notify({
        key: "p1:typescript",
        method: "workspace/didChangeWatchedFiles",
        params: {},
      }),
    ).toThrow(LspManagerError);
    h.manager.shutdownAll();
  });

  test("unknown keys are rejected", async () => {
    const h = makeHarness();
    expect(
      h.manager.request({ key: "nope", method: "initialize", params: {}, clientRequestId: 1 }),
    ).rejects.toThrow(LspManagerError);
  });

  test("$/cancelRequest cancels the matching in-flight request", async () => {
    const h = makeHarness();
    await h.manager.ensure(ENSURE_TS);
    const pending = h.manager.request({
      key: "p1:typescript",
      method: "textDocument/hover",
      params: { textDocument: { uri: "file:///home/u/proj/a.ts" } },
      clientRequestId: 7,
    });
    // Let the request reach the fake before cancelling.
    await sleep(20);
    h.manager.notify({ key: "p1:typescript", method: "$/cancelRequest", params: { id: 7 } });
    const res = await pending;
    expect(res.error?.code).toBe(REQUEST_CANCELLED);
    h.manager.shutdownAll();
  });
});

describe("lifecycle", () => {
  test("server-initiated notifications become events", async () => {
    const h = makeHarness();
    await h.manager.ensure(ENSURE_TS);
    h.fakes[0]?.conn.sendNotification("textDocument/publishDiagnostics", {
      uri: "file:///home/u/proj/a.ts",
      version: 3,
      diagnostics: [{ message: "boom" }],
    });
    h.fakes[0]?.conn.sendNotification("window/logMessage", { type: 3, message: "hi" });
    await sleep(20);
    expect(h.events.find((e) => e.topic === "lsp.diagnostics")?.payload).toEqual({
      key: "p1:typescript",
      uri: "file:///home/u/proj/a.ts",
      version: 3,
      diagnostics: [{ message: "boom" }],
    });
    expect(h.events.find((e) => e.topic === "lsp.message")?.payload).toEqual({
      key: "p1:typescript",
      message: { jsonrpc: "2.0", method: "window/logMessage", params: { type: 3, message: "hi" } },
    });
    h.manager.shutdownAll();
  });

  test("a crash emits serverStatus and frees the key", async () => {
    const h = makeHarness();
    await h.manager.ensure(ENSURE_TS);
    h.fakes[0]?.exit(1);
    await sleep(10);
    const crash = h.events.find(
      (e) =>
        e.topic === "lsp.serverStatus" && (e.payload as { status: string }).status === "crashed",
    );
    expect(crash).toBeDefined();
    // The key is free again — a new ensure spawns a fresh process.
    await h.manager.ensure(ENSURE_TS);
    expect(h.fakes).toHaveLength(2);
    h.manager.shutdownAll();
  });

  test("idle GC shuts the server down after the last didClose", async () => {
    const h = makeHarness({ idleShutdownMs: 30 });
    await h.manager.ensure(ENSURE_TS);
    const uri = "file:///home/u/proj/a.ts";
    h.manager.notify({
      key: "p1:typescript",
      method: "textDocument/didOpen",
      params: { textDocument: { uri, languageId: "typescript", version: 1, text: "" } },
    });
    h.manager.notify({
      key: "p1:typescript",
      method: "textDocument/didClose",
      params: { textDocument: { uri } },
    });
    await sleep(150);
    expect(h.fakes[0]?.killed).toBe(true);
    expect(h.fakes[0]?.requests.some((r) => r.method === "shutdown")).toBe(true);
    const exited = h.events.find(
      (e) =>
        e.topic === "lsp.serverStatus" && (e.payload as { status: string }).status === "exited",
    );
    expect(exited).toBeDefined();
  });

  test("didOpen cancels a pending idle shutdown", async () => {
    const h = makeHarness({ idleShutdownMs: 30 });
    await h.manager.ensure(ENSURE_TS);
    const uri = "file:///home/u/proj/a.ts";
    const open = { textDocument: { uri, languageId: "typescript", version: 1, text: "" } };
    h.manager.notify({ key: "p1:typescript", method: "textDocument/didOpen", params: open });
    h.manager.notify({
      key: "p1:typescript",
      method: "textDocument/didClose",
      params: { textDocument: { uri } },
    });
    h.manager.notify({ key: "p1:typescript", method: "textDocument/didOpen", params: open });
    await sleep(100);
    expect(h.fakes[0]?.killed).toBe(false);
    h.manager.shutdownAll();
  });

  test("shutdownAll kills every server and sends exit", async () => {
    const h = makeHarness();
    await h.manager.ensure(ENSURE_TS);
    await h.manager.ensure({ ...ENSURE_TS, languageId: "rust" });
    expect(h.fakes).toHaveLength(2);
    h.manager.shutdownAll();
    expect(h.fakes.every((f) => f.killed)).toBe(true);
    // A request after shutdown finds nothing.
    expect(
      h.manager.request({
        key: "p1:typescript",
        method: "shutdown",
        params: null,
        clientRequestId: 9,
      }),
    ).rejects.toThrow(LspManagerError);
  });
});
