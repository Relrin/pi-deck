import type { AgentBridge } from "./agent-bridge.js";

export function installLifecycleHandlers(getBridge: () => AgentBridge | undefined): void {
  const shutdown = (signal: NodeJS.Signals) => {
    const bridge = getBridge();
    try {
      bridge?.dispose();
    } catch (err) {
      process.stderr.write(`[worker] dispose failed on ${signal}: ${(err as Error).message}\n`);
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    emitError(err.message);
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    emitError(message);
    process.exit(1);
  });
}

function emitError(message: string): void {
  try {
    process.stdout.write(
      `${JSON.stringify({ kind: "event", topic: "host.error", payload: { message } })}\n`,
    );
  } catch {
    // ignore
  }
}
