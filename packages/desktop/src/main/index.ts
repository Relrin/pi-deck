import { app, BrowserWindow } from "electron";
import { type BackendHandle, startBackend } from "./backend";
import { waitForViteServer } from "./dev";
import { registerBridgeIpc } from "./ipc";
import { installAppMenu } from "./menu";
import { installCspHeaders } from "./security";
import { createWindow } from "./window";

const DEV_URL_DEFAULT = "http://127.0.0.1:5173";

app.setName("pi-deck");

let backend: BackendHandle | undefined;

app.whenReady().then(async () => {
  installCspHeaders();
  installAppMenu();

  try {
    backend = await startBackend(app);
    registerBridgeIpc({ url: `ws://127.0.0.1:${backend.port}`, token: backend.token });
  } catch (err) {
    console.error("[pi-deck] Failed to start backend:", err);
  }

  if (!app.isPackaged) {
    const url = process.env.VITE_DEV_SERVER_URL ?? DEV_URL_DEFAULT;
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
