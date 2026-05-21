import { PROTOCOL_VERSION } from "../protocol/version.js";
import { generateToken } from "./auth.js";
import { GitWatchManager } from "./git-watch-manager.js";
import { MetadataStore } from "./metadata-store.js";
import { ProviderManager } from "./provider-manager.js";
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

  const sessionManager = new SessionManager({ spawnWorker, providerManager });
  sessionManager.on("event", (topic, payload) => {
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

  const turnTracker = new TurnTracker(sessionManager);
  turnTracker.on("event", (topic, payload) => {
    wsHandle?.broadcast(topic, payload);
  });

  const router: RouterContext = {
    metadataStore,
    sessionManager,
    themeManager,
    providerManager,
    gitWatchManager,
    turnTracker,
    hostVersion: opts.hostVersion,
    protocolVersion: PROTOCOL_VERSION,
  };

  wsHandle = await startWsServer({ token, router });

  return {
    port: wsHandle.port,
    token,
    close: async () => {
      sessionManager.shutdown();
      await themeManager.shutdown();
      await gitWatchManager.shutdown();
      await wsHandle?.close();
    },
  };
}
