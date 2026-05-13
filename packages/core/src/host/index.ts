import { PROTOCOL_VERSION } from "../protocol/version.js";
import { generateToken } from "./auth.js";
import { MetadataStore } from "./metadata-store.js";
import type { RouterContext } from "./router.js";
import { SessionManager } from "./session-manager.js";
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

  const sessionManager = new SessionManager({ spawnWorker });
  sessionManager.on("event", (topic, payload) => {
    wsHandle?.broadcast(topic, payload);
  });

  const router: RouterContext = {
    metadataStore,
    sessionManager,
    hostVersion: opts.hostVersion,
    protocolVersion: PROTOCOL_VERSION,
  };

  wsHandle = await startWsServer({ token, router });

  return {
    port: wsHandle.port,
    token,
    close: async () => {
      sessionManager.shutdown();
      await wsHandle?.close();
    },
  };
}
