import { LanguageServerManager } from "../lsp/manager.js";
import { PROTOCOL_VERSION } from "../protocol/version.js";
import { TerminalManager } from "../terminal/index.js";
import { ArtefactsTracker } from "./artefacts-tracker.js";
import { generateToken } from "./auth.js";
import { FsWatchManager } from "./fs-watch-manager.js";
import { GitWatchManager } from "./git-watch-manager.js";
import { MetadataStore } from "./metadata-store.js";
import { PlanFileWatcher } from "./plan-file-watcher.js";
import { ProviderManager } from "./provider-manager.js";
import { ReviewStore } from "./review-store.js";
import type { RouterContext } from "./router.js";
import { SessionManager } from "./session-manager.js";
import { ThemeManager } from "./themes/index.js";
import { TurnTracker } from "./turn-tracker.js";
import { WorkerHandle, type WorkerSpawnOptions } from "./worker-handle.js";
import { startWsServer, type WsServerHandle } from "./ws-server.js";

export interface StartHostOptions {
  userDataDir: string;
  hostVersion: string;
  worker: {
    entry: string;
    execPath: string;
    execArgv: string[];
    env: NodeJS.ProcessEnv;
  };
}

export interface HostHandle {
  readonly port: number;
  readonly token: string;
  close: () => Promise<void>;
}

export async function startHost(opts: StartHostOptions): Promise<HostHandle> {
  const token = generateToken();
  const metadataStore = new MetadataStore(opts.userDataDir);
  await metadataStore.ensure();

  const providerManager = await ProviderManager.create(opts.userDataDir);

  let wsHandle: WsServerHandle | undefined;

  const spawnWorker = (): WorkerHandle => {
    const spawnOpts: WorkerSpawnOptions = {
      workerEntry: opts.worker.entry,
      execPath: opts.worker.execPath,
      execArgv: opts.worker.execArgv,
      env: opts.worker.env,
    };
    return new WorkerHandle(spawnOpts);
  };

  const sessionManager = new SessionManager({ spawnWorker, providerManager, metadataStore });
  sessionManager.on("event", (topic, payload) => {
    wsHandle?.broadcast(topic, payload);
  });

  const reviewStore = new ReviewStore(sessionManager);
  reviewStore.on("event", (topic, payload) => {
    wsHandle?.broadcast(topic, payload);
  });

  const themeManager = new ThemeManager(opts.userDataDir);
  await themeManager.init();
  themeManager.on("event", (topic, payload) => {
    wsHandle?.broadcast(topic, payload);
  });

  providerManager.on("event", (topic, payload) => {
    wsHandle?.broadcast(topic, payload);
  });

  const gitWatchManager = new GitWatchManager(metadataStore);
  gitWatchManager.on("event", (topic, payload) => {
    wsHandle?.broadcast(topic, payload);
  });

  const fsWatchManager = new FsWatchManager(metadataStore);
  fsWatchManager.on("event", (topic, payload) => {
    wsHandle?.broadcast(topic, payload);
  });

  const planFileWatcher = new PlanFileWatcher();
  planFileWatcher.on("event", (topic, payload) => {
    wsHandle?.broadcast(topic, payload);
  });

  const turnTracker = new TurnTracker(sessionManager, reviewStore);
  turnTracker.on("event", (topic, payload) => {
    wsHandle?.broadcast(topic, payload);
  });
  // Two-phase wiring: TurnTracker needs to call back into SessionManager.prompt() to take
  // the stash snapshot before the worker starts editing. SessionManager exposes a setter
  // so prompt() can await `turnTracker.beginTurn(...)` without a circular constructor dep.
  sessionManager.setTurnLifecycle({
    beginTurn: (sessionId, projectId, repoRoot) =>
      turnTracker.beginTurn(sessionId, projectId, repoRoot),
  });

  const artefactsTracker = new ArtefactsTracker(sessionManager);
  artefactsTracker.on("event", (topic, payload) => {
    wsHandle?.broadcast(topic, payload);
  });

  const terminalManager = new TerminalManager();
  terminalManager.on("event", (topic, payload) => {
    wsHandle?.broadcast(topic, payload);
  });

  const languageServerManager = new LanguageServerManager();
  languageServerManager.on("event", (topic, payload) => {
    wsHandle?.broadcast(topic, payload);
  });

  const router: RouterContext = {
    metadataStore,
    sessionManager,
    themeManager,
    providerManager,
    gitWatchManager,
    fsWatchManager,
    planFileWatcher,
    turnTracker,
    artefactsTracker,
    reviewStore,
    terminalManager,
    languageServerManager,
    hostVersion: opts.hostVersion,
    protocolVersion: PROTOCOL_VERSION,
  };

  wsHandle = await startWsServer({ token, router });

  return {
    port: wsHandle.port,
    token,
    close: async () => {
      sessionManager.shutdown();
      terminalManager.shutdownAll();
      languageServerManager.shutdownAll();
      await themeManager.shutdown();
      await gitWatchManager.shutdown();
      await fsWatchManager.shutdown();
      await planFileWatcher.shutdown();
      await wsHandle?.close();
    },
  };
}
