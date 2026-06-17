import { contextBridge, ipcRenderer } from "electron";

export type PlatformInfo = {
  os: NodeJS.Platform;
  arch: string;
};

export type BridgeConnectInfo = {
  url: string;
  token: string;
};

const platform: PlatformInfo = {
  os: process.platform,
  arch: process.arch,
};

const appVersion: string = process.env.npm_package_version ?? "dev";

contextBridge.exposeInMainWorld("platform", platform);
contextBridge.exposeInMainWorld("appVersion", appVersion);
export type OpenFileOptions = {
  filters?: Array<{ name: string; extensions: string[] }>;
};

export type ReadImageResult = {
  mimeType: string;
  data: string;
  name: string;
  byteSize: number;
};

contextBridge.exposeInMainWorld("windowControls", {
  minimize: (): Promise<void> => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: (): Promise<void> => ipcRenderer.invoke("window:toggle-maximize"),
  close: (): Promise<void> => ipcRenderer.invoke("window:close"),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke("window:is-maximized"),
  onMaximizedChange: (cb: (maximized: boolean) => void): (() => void) => {
    const listener = (_event: unknown, maximized: boolean) => cb(maximized);
    ipcRenderer.on("window:maximized-changed", listener);
    return () => ipcRenderer.removeListener("window:maximized-changed", listener);
  },
});

contextBridge.exposeInMainWorld("bridge", {
  connect: (): Promise<BridgeConnectInfo | undefined> => ipcRenderer.invoke("bridge:connect"),
  openDirectory: (): Promise<string | undefined> => ipcRenderer.invoke("bridge:openDirectory"),
  openFile: (opts?: OpenFileOptions): Promise<string | undefined> =>
    ipcRenderer.invoke("bridge:openFile", opts),
  openFiles: (opts?: OpenFileOptions): Promise<string[]> =>
    ipcRenderer.invoke("bridge:openFiles", opts),
  openPath: (path: string): Promise<string> => ipcRenderer.invoke("bridge:openPath", path),
  showItemInFolder: (path: string): Promise<void> =>
    ipcRenderer.invoke("bridge:showItemInFolder", path),
  readImage: (path: string): Promise<ReadImageResult> =>
    ipcRenderer.invoke("bridge:readImage", path),
});
