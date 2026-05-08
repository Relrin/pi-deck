import { app, BrowserWindow } from "electron";
import { waitForViteServer } from "./dev";
import { installAppMenu } from "./menu";
import { createWindow } from "./window";

const DEV_URL_DEFAULT = "http://127.0.0.1:5173";

app.setName("pi-deck");

app.whenReady().then(async () => {
  installAppMenu();

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
