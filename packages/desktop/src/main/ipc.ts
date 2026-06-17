import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { FileFilter } from "electron";
import { BrowserWindow, dialog, ipcMain, shell } from "electron";

export interface BridgeInfo {
  url: string;
  token: string;
}

export interface OpenFileOptions {
  filters?: FileFilter[];
}

export interface ReadImageResult {
  mimeType: string;
  data: string;
  name: string;
  byteSize: number;
}

const IMAGE_EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

let bridgeInfo: BridgeInfo | undefined;
let registered = false;
let windowControlsRegistered = false;

export function registerWindowControlIpc(): void {
  if (windowControlsRegistered) return;
  windowControlsRegistered = true;
  ipcMain.handle("window:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.handle("window:toggle-maximize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle("window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.handle(
    "window:is-maximized",
    (event) => BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false,
  );
}

export function registerBridgeIpc(info: BridgeInfo): void {
  bridgeInfo = info;
  if (registered) return;
  registered = true;
  ipcMain.handle("bridge:connect", () => bridgeInfo);
  ipcMain.handle("bridge:openDirectory", async () => {
    const focused = BrowserWindow.getFocusedWindow();
    const result = focused
      ? await dialog.showOpenDialog(focused, { properties: ["openDirectory"] })
      : await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled || result.filePaths.length === 0) return undefined;
    return result.filePaths[0];
  });
  ipcMain.handle("bridge:openFile", async (_event, opts?: OpenFileOptions) => {
    const options = { properties: ["openFile" as const], filters: opts?.filters };
    const focused = BrowserWindow.getFocusedWindow();
    const result = focused
      ? await dialog.showOpenDialog(focused, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return undefined;
    return result.filePaths[0];
  });
  ipcMain.handle("bridge:openFiles", async (_event, opts?: OpenFileOptions) => {
    const options = {
      properties: ["openFile" as const, "multiSelections" as const],
      filters: opts?.filters,
    };
    const focused = BrowserWindow.getFocusedWindow();
    const result = focused
      ? await dialog.showOpenDialog(focused, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return [];
    return result.filePaths;
  });
  // Open the given path with the OS's default application. Used by the Context tab to "open
  // file" affordances. Returns the error string from Electron (empty string on success) so the
  // caller can decide whether to surface it as a notification.
  ipcMain.handle("bridge:openPath", async (_event, path: string): Promise<string> => {
    if (typeof path !== "string" || path.length === 0) {
      throw new Error("openPath: path is required");
    }
    return shell.openPath(path);
  });
  // Reveal the given file in the OS file manager (Explorer / Finder / xdg). Silent on success.
  // Falls back gracefully if the file no longer exists — `showItemInFolder` is a no-op then.
  ipcMain.handle("bridge:showItemInFolder", async (_event, path: string): Promise<void> => {
    if (typeof path !== "string" || path.length === 0) {
      throw new Error("showItemInFolder: path is required");
    }
    shell.showItemInFolder(path);
  });
  // Read an image file from disk and ship it back as base64. Only used by the composer's
  // "Attach image…" picker — the renderer is sandboxed so it can't `fs.readFile` directly.
  ipcMain.handle("bridge:readImage", async (_event, path: string): Promise<ReadImageResult> => {
    if (typeof path !== "string" || path.length === 0) {
      throw new Error("readImage: path is required");
    }
    const ext = extname(path).toLowerCase();
    const mimeType = IMAGE_EXT_TO_MIME[ext];
    if (!mimeType) throw new Error(`Unsupported image extension: ${ext || "(none)"}`);
    const buf = await readFile(path);
    return {
      mimeType,
      data: buf.toString("base64"),
      name: basename(path),
      byteSize: buf.byteLength,
    };
  });
}
