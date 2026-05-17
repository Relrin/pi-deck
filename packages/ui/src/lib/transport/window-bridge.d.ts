export type BridgeConnectInfo = { url: string; token: string };

export type BridgeOpenFileOptions = {
  filters?: Array<{ name: string; extensions: string[] }>;
};

declare global {
  interface Window {
    bridge?: {
      connect?: () => Promise<BridgeConnectInfo | undefined>;
      openDirectory?: () => Promise<string | undefined>;
      openFile?: (opts?: BridgeOpenFileOptions) => Promise<string | undefined>;
    };
    appVersion?: string;
  }
}
