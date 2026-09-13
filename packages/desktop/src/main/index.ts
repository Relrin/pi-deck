import { LOCALES } from "@pi-deck/core";
import { app, BrowserWindow } from "electron";
import { type BackendHandle, startBackend } from "./backend";
import { waitForViteServer } from "./dev";
import { registerBridgeIpc, registerLocaleIpc, registerWindowControlIpc } from "./ipc";
import { installAppMenu } from "./menu";
import { systemLocaleGuess } from "./menu-strings";
import { installCspHeaders } from "./security";
import { createWindow } from "./window";

const DEV_URL_DEFAULT = "http://127.0.0.1:5173";

app.setName("pi-deck");

let backend: BackendHandle | undefined;
let shuttingDown = false;

async function shutdown(reason: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await backend?.close();
  } catch (err) {
    console.error(`[pi-deck] shutdown (${reason}) error:`, err);
  }
  app.exit(0);
}

// Force-kill scenarios (CTRL+C in dev, parent process termination) bypass
// before-quit, so subscribe to the raw signals too. tree-kill on the host side
// then cleans up worker children even if this handler doesn't run to completion.
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

/**
 * Warn if this build shipped without full ICU.
 *
 * Every date, duration, relative time and plural in the app goes through `Intl`, so a small-icu
 * Electron degrades all of them silently — and the test suite cannot catch it, because Bun has
 * full ICU. Packaged builds also gate out the devtools menu item, so the renderer console is not
 * reachable to check from; this reports on stdout, where launching the binary from a terminal
 * shows it.
 */
function warnOnStrippedIcu(): void {
  const supported = Intl.DateTimeFormat.supportedLocalesOf([...LOCALES]);
  if (supported.length === LOCALES.length) return;
  console.warn(
    `[pi-deck] This build lacks full ICU — Intl supports only [${supported.join(", ")}] ` +
      `of [${LOCALES.join(", ")}]. Dates, durations and plurals will fall back to the root locale.`,
  );
}

app.whenReady().then(async () => {
  warnOnStrippedIcu();
  installCspHeaders();
  // Seeded from the OS locale so the first paint agrees with Electron's own `role:` labels; the
  // renderer corrects it over `app:set-locale` if the user chose a different UI language.
  installAppMenu(systemLocaleGuess());
  registerWindowControlIpc();
  registerLocaleIpc();

  try {
    backend = await startBackend(app);
    registerBridgeIpc({ url: `ws://127.0.0.1:${backend.port}`, token: backend.token });
  } catch (err) {
    console.error("[pi-deck] Failed to start backend:", err);
  }

  if (!app.isPackaged) {
    const url =
      process.env.ELECTRON_RENDERER_URL ?? process.env.VITE_DEV_SERVER_URL ?? DEV_URL_DEFAULT;
    try {
      await waitForViteServer(url);
    } catch (err) {
      console.error("[pi-deck] Failed to reach Vite dev server:", err);
    }
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  if (!backend) return;
  try {
    await backend.close();
  } catch (err) {
    console.error("[pi-deck] Failed to shut down backend:", err);
  }
});
