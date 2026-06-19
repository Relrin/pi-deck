import { createRequire } from "node:module";
import { join } from "node:path";
import { setTrashImpl } from "@pi-deck/core/fs/index.js";
import { setSecretCrypto, startHost } from "@pi-deck/core/host/index.js";
import { type App, safeStorage, shell } from "electron";

function resolveMcpAdapterVersion(): string | null {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("pi-mcp-adapter/package.json") as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
}

export interface BackendHandle {
  port: number;
  token: string;
  close: () => Promise<void>;
}

export async function startBackend(app: App): Promise<BackendHandle> {
  setTrashImpl(async (absPath) => {
    await shell.trashItem(absPath);
  });

  // OS-backed encryption for MCP bearer tokens (stored encrypted, never written to mcp.json).
  setSecretCrypto({
    available: () => safeStorage.isEncryptionAvailable(),
    encrypt: (plain) => safeStorage.encryptString(plain).toString("base64"),
    decrypt: (b64) => safeStorage.decryptString(Buffer.from(b64, "base64")),
  });

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
    mcpAdapterVersion: resolveMcpAdapterVersion(),
    worker: {
      entry: workerEntry,
      execPath: process.execPath,
      execArgv: [],
      env,
    },
  });

  return host;
}
