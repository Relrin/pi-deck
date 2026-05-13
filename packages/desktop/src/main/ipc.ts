import { ipcMain } from "electron";

export interface BridgeInfo {
  url: string;
  token: string;
}

let bridgeInfo: BridgeInfo | undefined;
let registered = false;

export function registerBridgeIpc(info: BridgeInfo): void {
  bridgeInfo = info;
  if (registered) return;
  registered = true;
  ipcMain.handle("bridge:connect", () => bridgeInfo);
}
