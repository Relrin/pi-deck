export type BridgeConnectInfo = { url: string; token: string };

export type BridgeOpenFileOptions = {
  filters?: Array<{ name: string; extensions: string[] }>;
};

export type BridgeReadImageResult = {
  mimeType: string;
  /** Base64 (no `data:…;base64,` prefix). */
  data: string;
  name: string;
  byteSize: number;
};

declare global {
  interface Window {
    bridge?: {
      connect?: () => Promise<BridgeConnectInfo | undefined>;
      openDirectory?: () => Promise<string | undefined>;
      openFile?: (opts?: BridgeOpenFileOptions) => Promise<string | undefined>;
      openFiles?: (opts?: BridgeOpenFileOptions) => Promise<string[]>;
      readImage?: (path: string) => Promise<BridgeReadImageResult>;
    };
    appVersion?: string;
  }
}
