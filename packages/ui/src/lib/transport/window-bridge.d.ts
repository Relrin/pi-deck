export type BridgeConnectInfo = { url: string; token: string };

declare global {
  interface Window {
    bridge?: {
      connect?: () => Promise<BridgeConnectInfo | undefined>;
      openDirectory?: () => Promise<string | undefined>;
    };
  }
}
