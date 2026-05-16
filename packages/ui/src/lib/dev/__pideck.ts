import { usePreferencesStore } from "../../theme/usePreferencesStore.js";
import { useThemeStore } from "../../theme/useThemeStore.js";
import type { ProtocolClient } from "../transport/protocol-client.js";

/**
 * DEV-only devtools escape hatch. Mounted on `window.__pideck` from `App.tsx` behind
 * `import.meta.env.DEV`. Never ships in production builds.
 */
export interface PideckDevApi {
  themes: {
    list: () => Promise<unknown>;
    get: (name: string) => Promise<unknown>;
    setActive: (name: string) => Promise<void>;
    active: () => string;
  };
  prefs: {
    setDensity: (d: "compact" | "cozy") => void;
    setFonts: (f: "default" | "sans-only" | "mono-only") => void;
    state: () => { density: "compact" | "cozy"; fonts: "default" | "sans-only" | "mono-only" };
  };
}

declare global {
  interface Window {
    __pideck?: PideckDevApi;
  }
}

export function installPideckDevHatch(getClient: () => ProtocolClient | undefined): void {
  const api: PideckDevApi = {
    themes: {
      list: async () => {
        const client = getClient();
        if (!client) throw new Error("WS client not connected yet");
        return client.themes.list();
      },
      get: async (name) => {
        const client = getClient();
        if (!client) throw new Error("WS client not connected yet");
        return client.themes.get(name);
      },
      setActive: async (name) => {
        const client = getClient();
        if (!client) throw new Error("WS client not connected yet");
        await client.themes.setActive(name);
      },
      active: () => useThemeStore.getState().activeName,
    },
    prefs: {
      setDensity: (d) => usePreferencesStore.getState().setDensity(d),
      setFonts: (f) => usePreferencesStore.getState().setFonts(f),
      state: () => {
        const s = usePreferencesStore.getState();
        return { density: s.density, fonts: s.fonts };
      },
    },
  };
  window.__pideck = api;
}
