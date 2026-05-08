import { contextBridge } from "electron";

export type PlatformInfo = {
  os: NodeJS.Platform;
  arch: string;
};

const platform: PlatformInfo = {
  os: process.platform,
  arch: process.arch,
};

const appVersion: string = process.env.npm_package_version ?? "dev";

contextBridge.exposeInMainWorld("platform", platform);
contextBridge.exposeInMainWorld("appVersion", appVersion);
contextBridge.exposeInMainWorld("bridge", {});
