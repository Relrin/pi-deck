import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import treeKill from "tree-kill";
import { CancellationTokenSource, ResponseError } from "vscode-jsonrpc/node";
import {
  EVENT_LSP_DIAGNOSTICS,
  EVENT_LSP_MESSAGE,
  EVENT_LSP_SERVER_STATUS,
  type EventTopic,
} from "../protocol/events.js";
import { LspConnection } from "./connection.js";
import {
  buildServerLaunch,
  clearLspDetectionCache,
  detectServer,
  environmentForRoot,
  type LspDetectionDeps,
  type LspEnvironment,
  type ServerLaunch,
} from "./environment.js";
import {
  type CustomLanguageServerDef,
  LANGUAGE_SERVERS,
  type LanguageServerDef,
  LSP_NOTIFY_ALLOWLIST,
  LSP_REQUEST_ALLOWLIST,
  serverForLanguageId,
} from "./server-defs.js";
import type { LspMapping } from "./uri.js";

/** Idle window after the last document closes before the server is shut down. */
const IDLE_SHUTDOWN_MS = 5 * 60_000;
/** How long the graceful LSP `shutdown` request may take before we hard-kill. */
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 2_000;

export type LanguageServerManagerEvents = {
  event: [topic: EventTopic, payload: unknown];
};

export class LspManagerError extends Error {
  constructor(
    public readonly code: "lsp_unknown_key" | "lsp_method_not_allowed",
    message: string,
  ) {
    super(message);
  }
}

/** Minimal child-process surface so tests can substitute PassThrough-stream fakes. */
export interface SpawnedServer {
  pid: number | undefined;
  stdin: NodeJS.WritableStream;
  stdout: NodeJS.ReadableStream;
  onExit: (cb: (code: number | null) => void) => void;
  kill: () => void;
}

export type SpawnServerFn = (launch: ServerLaunch, cwd: string | undefined) => SpawnedServer;

function defaultSpawnServer(launch: ServerLaunch, cwd: string | undefined): SpawnedServer {
  const child = spawn(launch.command, launch.args, {
    cwd,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    windowsVerbatimArguments: launch.windowsVerbatimArguments,
  });
  if (!child.stdin || !child.stdout || !child.stderr) {
    throw new Error("Failed to open language-server stdio pipes");
  }
  child.stderr.on("data", (chunk: Buffer) => {
    process.stderr.write(`[lsp ${child.pid}] ${chunk.toString("utf8")}`);
  });
  return {
    pid: child.pid,
    stdin: child.stdin,
    stdout: child.stdout,
    onExit: (cb) => child.on("exit", (code) => cb(code)),
    kill: () => {
      const pid = child.pid;
      if (!pid) {
        try {
          child.kill();
        } catch {
          // Already gone.
        }
        return;
      }
      // Same rationale as WorkerHandle.kill: Windows children don't share a POSIX process
      // group, so take down the whole subtree (wsl.exe wraps a shell wraps the server).
      treeKill(pid, "SIGTERM", () => {});
    },
  };
}

interface ServerEntry {
  key: string;
  def: LanguageServerDef;
  projectId: string;
  env: LspEnvironment;
  launch: ServerLaunch;
  proc: SpawnedServer;
  conn: LspConnection;
  /** A successful `initialize` round-trip happened on the current process. */
  initialized: boolean;
  /** Server-form URIs currently open in the renderer; empty set arms the idle timer. */
  openDocs: Set<string>;
  idleTimer: ReturnType<typeof setTimeout> | undefined;
  /** Renderer request id → cancellation source, for `$/cancelRequest` interception. */
  pendingCancels: Map<string | number, CancellationTokenSource>;
  done: boolean;
}

export type EnsureResult =
  | { status: "running"; key: string; serverId: string; rootUri: string; mapping: LspMapping }
  | { status: "missing"; serverId: string; installHint: string }
  | { status: "unsupported" };

export interface StatusResult {
  mapping: LspMapping;
  servers: Array<{
    serverId: string;
    label: string;
    languageIds: string[];
    command: string;
    available: boolean;
    running: boolean;
    installHint: string;
    custom: boolean;
  }>;
}

export interface LanguageServerManagerOptions {
  spawnServer?: SpawnServerFn;
  detectionDeps?: Partial<LspDetectionDeps>;
  idleShutdownMs?: number;
}

/**
 * Owns the language-server child processes, one per `(projectId, serverId)`, in the host.
 *
 * This is a process owner plus an allowlisted JSON-RPC pipe — the renderer's CodeMirror LSP
 * client runs the actual LSP session (initialize, document sync). The manager's only protocol
 * smarts are confinement and lifecycle: it pins `rootUri`/`workspaceFolders` on the in-flight
 * `initialize`, intercepts `$/cancelRequest` (host-side request ids differ from the
 * renderer's), tracks open documents for idle GC, and transparently restarts a server when a
 * reloaded renderer re-initializes it. `shutdownAll()` runs from `host.close()` — no orphans.
 */
export class LanguageServerManager extends EventEmitter<LanguageServerManagerEvents> {
  private readonly entries = new Map<string, ServerEntry>();
  private readonly pendingEnsures = new Map<string, Promise<EnsureResult>>();
  private readonly spawnServer: SpawnServerFn;
  private readonly detectionDeps: Partial<LspDetectionDeps>;
  private readonly idleShutdownMs: number;
  private customServers: readonly CustomLanguageServerDef[] = [];

  constructor(options: LanguageServerManagerOptions = {}) {
    super();
    this.spawnServer = options.spawnServer ?? defaultSpawnServer;
    this.detectionDeps = options.detectionDeps ?? {};
    this.idleShutdownMs = options.idleShutdownMs ?? IDLE_SHUTDOWN_MS;
  }

  /**
   * Replace the user-defined server list (startup load + every settings mutation). Running
   * custom servers whose definition changed or disappeared are shut down — the next matching
   * tab re-ensures them with the new command. Detection results are stale either way, so the
   * PATH-probe cache is cleared wholesale.
   */
  setCustomServers(defs: readonly CustomLanguageServerDef[]): void {
    const next = new Map(defs.map((d) => [d.id, d]));
    for (const [key, entry] of this.entries) {
      const wasCustom = this.customServers.some((d) => d.id === entry.def.id);
      if (!wasCustom) continue;
      const replacement = next.get(entry.def.id);
      const unchanged =
        replacement &&
        replacement.command === entry.def.command &&
        JSON.stringify(replacement.args) === JSON.stringify(entry.def.args) &&
        JSON.stringify(replacement.languageIds) === JSON.stringify(entry.def.languageIds);
      if (!unchanged) void this.shutdown(key);
    }
    this.customServers = defs;
    clearLspDetectionCache();
  }

  /** Lazily spawn (or reuse) the server covering `languageId` for a project root. */
  async ensure(args: {
    projectId: string;
    projectRoot: string;
    languageId: string;
  }): Promise<EnsureResult> {
    const def = serverForLanguageId(args.languageId, this.customServers);
    if (!def) return { status: "unsupported" };
    const env = environmentForRoot(args.projectRoot);
    if (!env) return { status: "unsupported" };

    const key = `${args.projectId}:${def.id}`;
    const existing = this.entries.get(key);
    if (existing && !existing.done) return this.runningResult(existing);

    const pending = this.pendingEnsures.get(key);
    if (pending) return pending;
    const spawnPromise = this.spawnEntry(key, def, args.projectId, env);
    this.pendingEnsures.set(key, spawnPromise);
    try {
      return await spawnPromise;
    } finally {
      this.pendingEnsures.delete(key);
    }
  }

  /** Availability snapshot for the settings UI. `refresh` re-probes PATH / the distro. */
  async status(args: {
    projectId: string;
    projectRoot: string;
    refresh?: boolean;
  }): Promise<StatusResult> {
    if (args.refresh) clearLspDetectionCache();
    const env = environmentForRoot(args.projectRoot);
    const mapping: LspMapping = env?.mapping ?? { kind: "local" };
    const builtinIds = new Set(LANGUAGE_SERVERS.map((def) => def.id));
    const allDefs: readonly LanguageServerDef[] = [...LANGUAGE_SERVERS, ...this.customServers];
    const servers = await Promise.all(
      allDefs.map(async (def) => ({
        serverId: def.id,
        label: def.label,
        languageIds: [...def.languageIds],
        command: def.command,
        available: env ? (await detectServer(def, mapping, this.detectionDeps)).available : false,
        running: this.entries.has(`${args.projectId}:${def.id}`),
        installHint: def.installHint,
        custom: !builtinIds.has(def.id),
      })),
    );
    return { mapping, servers };
  }

  /**
   * Forward an allowlisted client→server request. LSP-level failures return in-band as
   * `{ error }` so the renderer can fabricate the matching JSON-RPC error response.
   */
  async request(args: {
    key: string;
    method: string;
    params: unknown;
    clientRequestId: string | number;
  }): Promise<{ result?: unknown; error?: { code: number; message: string; data?: unknown } }> {
    const entry = this.requireEntry(args.key);
    if (!LSP_REQUEST_ALLOWLIST.has(args.method)) {
      throw new LspManagerError("lsp_method_not_allowed", `LSP method not allowed: ${args.method}`);
    }

    let params = args.params;
    if (args.method === "initialize") {
      // A second initialize means the renderer reloaded and lost its client state — the
      // server can't be re-initialized, so restart it transparently under the same key.
      if (entry.initialized) this.restart(entry);
      params = this.rewriteInitializeParams(entry, params);
    }

    const cts = new CancellationTokenSource();
    entry.pendingCancels.set(args.clientRequestId, cts);
    try {
      const result = await entry.conn.request(args.method, params, cts.token);
      if (args.method === "initialize") entry.initialized = true;
      return { result };
    } catch (err) {
      if (err instanceof ResponseError) {
        return { error: { code: err.code, message: err.message, data: err.data } };
      }
      throw err;
    } finally {
      entry.pendingCancels.delete(args.clientRequestId);
      cts.dispose();
    }
  }

  /** Forward an allowlisted client→server notification. `$/cancelRequest` is intercepted. */
  notify(args: { key: string; method: string; params: unknown }): void {
    const entry = this.requireEntry(args.key);
    if (!LSP_NOTIFY_ALLOWLIST.has(args.method)) {
      throw new LspManagerError("lsp_method_not_allowed", `LSP method not allowed: ${args.method}`);
    }
    if (args.method === "$/cancelRequest") {
      // Never forwarded raw — the host connection numbers requests itself, so the renderer's
      // id would cancel nothing (or the wrong call). Cancel the matching token instead.
      const id = (args.params as { id?: string | number } | null)?.id;
      if (id !== undefined) entry.pendingCancels.get(id)?.cancel();
      return;
    }
    if (args.method === "textDocument/didOpen") {
      const uri = docUri(args.params);
      if (uri) entry.openDocs.add(uri);
      this.clearIdleTimer(entry);
    } else if (args.method === "textDocument/didClose") {
      const uri = docUri(args.params);
      if (uri) entry.openDocs.delete(uri);
      if (entry.openDocs.size === 0) this.armIdleTimer(entry);
    }
    entry.conn.notify(args.method, args.params);
  }

  /** Graceful stop (user toggle, idle GC): LSP shutdown → exit → hard kill backstop. */
  async shutdown(key: string): Promise<void> {
    const entry = this.entries.get(key);
    if (!entry || entry.done) return;
    entry.done = true;
    this.entries.delete(key);
    this.cleanupEntry(entry);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        entry.conn.request("shutdown", null),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, GRACEFUL_SHUTDOWN_TIMEOUT_MS);
        }),
      ]);
      entry.conn.notify("exit", undefined);
    } catch {
      // Server already gone — the kill below is the answer either way.
    } finally {
      if (timer) clearTimeout(timer);
    }
    entry.conn.dispose();
    entry.proc.kill();
    this.emit("event", EVENT_LSP_SERVER_STATUS, {
      key,
      serverId: entry.def.id,
      projectId: entry.projectId,
      status: "exited",
    });
  }

  /** Kill every server synchronously. Called from `host.close()` — leaves no orphans. */
  shutdownAll(): void {
    for (const [, entry] of this.entries) {
      entry.done = true;
      this.cleanupEntry(entry);
      try {
        entry.conn.notify("exit", undefined);
      } catch {
        // Best effort — the kill is authoritative.
      }
      entry.conn.dispose();
      entry.proc.kill();
    }
    this.entries.clear();
  }

  private runningResult(entry: ServerEntry): EnsureResult {
    return {
      status: "running",
      key: entry.key,
      serverId: entry.def.id,
      rootUri: entry.env.rootUri,
      mapping: entry.env.mapping,
    };
  }

  private async spawnEntry(
    key: string,
    def: LanguageServerDef,
    projectId: string,
    env: LspEnvironment,
  ): Promise<EnsureResult> {
    const launch = await buildServerLaunch(def, env.mapping, this.detectionDeps);
    if (!launch) return { status: "missing", serverId: def.id, installHint: def.installHint };
    const entry = this.startProcess({
      key,
      def,
      projectId,
      env,
      launch,
      initialized: false,
      openDocs: new Set(),
      idleTimer: undefined,
      pendingCancels: new Map(),
      done: false,
    });
    this.entries.set(key, entry);
    this.emit("event", EVENT_LSP_SERVER_STATUS, {
      key,
      serverId: def.id,
      projectId,
      status: "running",
    });
    return this.runningResult(entry);
  }

  /**
   * Spawn the child + connection for an entry (fresh or restarting). Handlers resolve the
   * canonical entry through the map (not a closure capture) so they stay correct after a
   * restart swaps `proc`/`conn` on the live entry object.
   */
  private startProcess(base: Omit<ServerEntry, "proc" | "conn">): ServerEntry {
    // WSL maps the guest cwd from rootUri; a UNC cwd through wsl.exe is flaky, so skip it.
    const cwd = base.env.mapping.kind === "local" ? base.env.deckRoot : undefined;
    const proc = this.spawnServer(base.launch, cwd);
    const conn = new LspConnection(proc.stdin, proc.stdout, {
      onNotification: (method, params) => {
        const current = this.entries.get(base.key);
        if (!current || current.conn !== conn) return; // stale connection after a restart
        this.onServerNotification(current, method, params);
      },
    });
    proc.onExit((code) => {
      const current = this.entries.get(base.key);
      // Stale handler after a restart swapped the process, or we initiated the kill.
      if (!current || current.proc !== proc || current.done) return;
      current.done = true;
      this.cleanupEntry(current);
      this.entries.delete(base.key);
      conn.dispose();
      this.emit("event", EVENT_LSP_SERVER_STATUS, {
        key: current.key,
        serverId: current.def.id,
        projectId: current.projectId,
        status: code === 0 ? "exited" : "crashed",
        message: code === 0 ? undefined : `${current.def.command} exited with code ${code ?? "?"}`,
      });
    });
    return { ...base, proc, conn };
  }

  /** Replace an entry's process in place (same key); the renderer never notices. */
  private restart(entry: ServerEntry): void {
    const oldProc = entry.proc;
    const oldConn = entry.conn;
    for (const cts of entry.pendingCancels.values()) cts.cancel();
    entry.pendingCancels.clear();
    entry.openDocs.clear();
    entry.initialized = false;
    this.clearIdleTimer(entry);
    // Swap in the fresh process *before* killing the old one so the old exit handler sees
    // `entry.proc !== proc` and stays silent.
    const fresh = this.startProcess(entry);
    entry.proc = fresh.proc;
    entry.conn = fresh.conn;
    oldConn.dispose();
    oldProc.kill();
  }

  private rewriteInitializeParams(entry: ServerEntry, params: unknown): Record<string, unknown> {
    const base =
      typeof params === "object" && params !== null ? (params as Record<string, unknown>) : {};
    const name = entry.env.deckRoot.split("/").filter(Boolean).pop() ?? entry.env.deckRoot;
    return {
      ...base,
      // Guest servers can't see the host pid (different pid namespace) — null disables
      // parent-process watchdogs that would otherwise fire on a bogus pid.
      processId: entry.env.mapping.kind === "local" ? process.pid : null,
      rootUri: entry.env.rootUri,
      rootPath: null,
      workspaceFolders: [{ uri: entry.env.rootUri, name }],
    };
  }

  private onServerNotification(entry: ServerEntry, method: string, params: unknown): void {
    if (entry.done) return;
    if (method === "textDocument/publishDiagnostics") {
      const p = params as { uri?: string; version?: number; diagnostics?: unknown[] } | null;
      if (p?.uri && Array.isArray(p.diagnostics)) {
        this.emit("event", EVENT_LSP_DIAGNOSTICS, {
          key: entry.key,
          uri: p.uri,
          version: p.version,
          diagnostics: p.diagnostics,
        });
      }
      return;
    }
    this.emit("event", EVENT_LSP_MESSAGE, {
      key: entry.key,
      message: { jsonrpc: "2.0", method, params },
    });
  }

  private requireEntry(key: string): ServerEntry {
    const entry = this.entries.get(key);
    if (!entry || entry.done) {
      throw new LspManagerError("lsp_unknown_key", `No running language server for key ${key}`);
    }
    return entry;
  }

  private armIdleTimer(entry: ServerEntry): void {
    this.clearIdleTimer(entry);
    entry.idleTimer = setTimeout(() => {
      entry.idleTimer = undefined;
      if (!entry.done && entry.openDocs.size === 0) void this.shutdown(entry.key);
    }, this.idleShutdownMs);
  }

  private clearIdleTimer(entry: ServerEntry): void {
    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer);
      entry.idleTimer = undefined;
    }
  }

  private cleanupEntry(entry: ServerEntry): void {
    this.clearIdleTimer(entry);
    for (const cts of entry.pendingCancels.values()) cts.cancel();
    entry.pendingCancels.clear();
  }
}

function docUri(params: unknown): string | null {
  const uri = (params as { textDocument?: { uri?: unknown } } | null)?.textDocument?.uri;
  return typeof uri === "string" ? uri : null;
}
