import { BrowserWindow, dialog, ipcMain } from "electron";

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
  ipcMain.handle("bridge:openDirectory", async () => {
    const focused = BrowserWindow.getFocusedWindow();
    const result = focused
      ? await dialog.showOpenDialog(focused, { properties: ["openDirectory"] })
      : await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled || result.filePaths.length === 0) return undefined;
    return result.filePaths[0];
  });
}
