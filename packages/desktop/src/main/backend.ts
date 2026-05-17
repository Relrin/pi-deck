import { join } from "node:path";
import { startHost } from "@pi-deck/core/host/index.js";
import type { App } from "electron";

export interface BackendHandle {
  port: number;
  token: string;
  close: () => Promise<void>;
}

export async function startBackend(app: App): Promise<BackendHandle> {
  const userDataDir = app.getPath("userData");
  // Co-built with main via electron-vite (multi-entry main config), so the worker
  // sits alongside index.mjs under dist/main. Anchor from app.getAppPath() because
  // bundlers inline __dirname to the source path at build time.
  const workerEntry = join(app.getAppPath(), "dist", "main", "worker.mjs");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
  };

  const host = await startHost({
    userDataDir,
    hostVersion: app.getVersion() ?? "dev",
    worker: {
      entry: workerEntry,
      execPath: process.execPath,
      execArgv: [],
      env,
    },
  });

  return host;
}
