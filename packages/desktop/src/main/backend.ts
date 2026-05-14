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
  // Use app.getAppPath() because Bun's bundler inlines __dirname to the source
  // directory at build time, which would point at packages/desktop/src/main rather
  // than the runtime dist/main location.
  const workerEntry = join(app.getAppPath(), "dist", "worker.mjs");
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
