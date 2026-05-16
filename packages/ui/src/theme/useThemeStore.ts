import type { ThemeListing, ThemeSpec } from "@pi-deck/core";
import { create } from "zustand";
import type { ProtocolClient } from "../lib/transport/protocol-client.js";
import { applyTheme } from "./loader.js";
import { setShikiThemeByKind } from "./shiki-bridge.js";

const STORAGE_KEY = "pi-deck:active-theme";
const FALLBACK_THEME = "default-dark";

export interface ThemeStoreState {
  activeName: string;
  available: ThemeListing[];
  /** Latest spec applied to the DOM — cached so we can re-apply after preference toggles. */
  activeSpec: ThemeSpec | undefined;

  /** First-time bootstrap: fetch list + active spec, apply to DOM. */
  hydrate: (client: ProtocolClient) => Promise<void>;
  /** Ask host to switch active theme; host emits `theme.changed` which actually applies it. */
  setActive: (client: ProtocolClient, name: string) => Promise<void>;
  /** Apply a spec to the DOM and remember it. Called from the `theme.changed` handler. */
  applySpec: (name: string, spec: ThemeSpec | undefined, available: ThemeListing[]) => void;
}

function readStoredName(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? FALLBACK_THEME;
  } catch {
    return FALLBACK_THEME;
  }
}

function writeStoredName(name: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // localStorage may be disabled in some Electron profiles; ignore.
  }
}

function syncShiki(spec: ThemeSpec | undefined, available: ThemeListing[], name: string): void {
  const entry = available.find((t) => t.name === name);
  const kind = spec?.meta?.kind ?? entry?.kind ?? "dark";
  // VS Code raw payload lives on the host; the renderer cannot see it directly. The bridge picks
  // a bundled Shiki theme based on kind. A follow-up wires the raw payload through the protocol.
  setShikiThemeByKind(kind);
}

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  activeName: readStoredName(),
  available: [],
  activeSpec: undefined,

  hydrate: async (client) => {
    const { activeName, themes } = await client.themes.list();
    const stored = readStoredName();
    const requested = themes.some((t) => t.name === stored) ? stored : activeName;
    let spec: ThemeSpec | undefined;
    try {
      spec = await client.themes.get(requested);
    } catch {
      spec = undefined;
    }
    if (requested !== activeName) {
      // The host's notion of active may differ from local prefs; align them so the next launch
      // doesn't flicker. Fire-and-forget; the resulting theme.changed event will re-apply if it
      // actually switches.
      void client.themes.setActive(requested).catch(() => undefined);
    }
    get().applySpec(requested, spec, themes);
  },

  setActive: async (client, name) => {
    await client.themes.setActive(name);
  },

  applySpec: (name, spec, available) => {
    writeStoredName(name);
    if (spec) applyTheme(spec);
    syncShiki(spec, available, name);
    set({ activeName: name, available, activeSpec: spec });
  },
}));
