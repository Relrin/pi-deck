import { join } from "node:path";
import { app, BrowserWindow, shell } from "electron";
import { loadState, saveState, type WindowBounds } from "./window-state";

const DEFAULT_WIDTH = 1400;
const DEFAULT_HEIGHT = 900;
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;
const SAVE_DEBOUNCE_MS = 250;
const DEV_URL_DEFAULT = "http://127.0.0.1:5173";

export function createWindow(): BrowserWindow {
  const saved = loadState();
  const bounds: WindowBounds = {
    width: saved?.width ?? DEFAULT_WIDTH,
    height: saved?.height ?? DEFAULT_HEIGHT,
    x: saved?.x,
    y: saved?.y,
  };

  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    backgroundColor: "#0e0f12",
    title: "pi-deck",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    // symbolColor matches --ink-0 in the dark theme; light-mode users get a slight contrast
    // hit on the overlay symbols until nativeTheme updates are wired
    titleBarOverlay:
      process.platform !== "darwin"
        ? { color: "#00000000", symbolColor: "#e7e9ee", height: 44 }
        : undefined,
    webPreferences: {
      // app.getAppPath() rather than __dirname: Bun inlines __dirname to the source
      // directory at build time, so we have to root paths from the Electron app root.
      preload: join(app.getAppPath(), "dist", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  let saveTimer: NodeJS.Timeout | null = null;
  const persistBounds = () => {
    const b = win.getBounds();
    saveState({ width: b.width, height: b.height, x: b.x, y: b.y });
  };
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persistBounds, SAVE_DEBOUNCE_MS);
  };

  win.on("resize", scheduleSave);
  win.on("move", scheduleSave);
  win.on("close", () => {
    if (saveTimer) clearTimeout(saveTimer);
    persistBounds();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (!app.isPackaged) {
    const devUrl =
      process.env.ELECTRON_RENDERER_URL ?? process.env.VITE_DEV_SERVER_URL ?? DEV_URL_DEFAULT;
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(join(app.getAppPath(), "dist", "renderer", "index.html"));
  }

  return win;
}
