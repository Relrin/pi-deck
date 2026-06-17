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
      /**
       * Open the file or folder at `path` with the OS's default application. Resolves with an
       * empty string on success, or an Electron-provided error string on failure (we surface it
       * as a notification rather than throwing).
       */
      openPath?: (path: string) => Promise<string>;
      /** Reveal `path` in the OS file manager (Explorer / Finder / xdg-open --select). */
      showItemInFolder?: (path: string) => Promise<void>;
      readImage?: (path: string) => Promise<BridgeReadImageResult>;
    };
    windowControls?: {
      minimize?: () => Promise<void>;
      toggleMaximize?: () => Promise<void>;
      close?: () => Promise<void>;
      isMaximized?: () => Promise<boolean>;
      /** Subscribe to OS maximize/unmaximize; returns an unsubscribe fn. */
      onMaximizedChange?: (cb: (maximized: boolean) => void) => () => void;
    };
    appVersion?: string;
  }
}
