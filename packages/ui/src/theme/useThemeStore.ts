import type { ThemeListing, ThemeSpec } from "@pi-deck/core";
import { create } from "zustand";
import type { ProtocolClient } from "../lib/transport/protocol-client.js";
import { applyTheme } from "./loader.js";
import { setShikiThemeByKind, setShikiThemeFromVSCode } from "./shiki-bridge.js";

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
  /** Remove a user theme; host falls back to default if it was active. */
  deleteTheme: (client: ProtocolClient, name: string) => Promise<void>;
  /** Apply a spec to the DOM and remember it. Called from the `theme.changed` handler. */
  applySpec: (
    name: string,
    spec: ThemeSpec | undefined,
    available: ThemeListing[],
    vscodeRaw?: unknown,
  ) => void;
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

function syncShiki(
  spec: ThemeSpec | undefined,
  available: ThemeListing[],
  name: string,
  vscodeRaw: unknown,
): void {
  // Imported VS Code themes ship their original JSON; Shiki tokenises directly off that so
  // syntax highlighting matches the source theme exactly. For bundled / pi-deck-format themes
  // we fall back to a curated Shiki theme keyed by light/dark kind.
  if (vscodeRaw !== undefined && vscodeRaw !== null) {
    setShikiThemeFromVSCode(vscodeRaw);
    return;
  }
  const entry = available.find((t) => t.name === name);
  const kind = spec?.meta?.kind ?? entry?.kind ?? "dark";
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
    let vscodeRaw: unknown;
    try {
      const fetched = await client.themes.get(requested);
      spec = fetched.spec;
      vscodeRaw = fetched.vscodeRaw;
    } catch {
      spec = undefined;
    }
    if (requested !== activeName) {
      // The host's notion of active may differ from local prefs; align them so the next launch
      // doesn't flicker. Fire-and-forget; the resulting theme.changed event will re-apply if it
      // actually switches.
      void client.themes.setActive(requested).catch(() => undefined);
    }
    get().applySpec(requested, spec, themes, vscodeRaw);
  },

  setActive: async (client, name) => {
    await client.themes.setActive(name);
  },

  deleteTheme: async (client, name) => {
    await client.themes.delete(name);
  },

  applySpec: (name, spec, available, vscodeRaw) => {
    writeStoredName(name);
    if (spec) applyTheme(spec);
    syncShiki(spec, available, name, vscodeRaw);
    set({ activeName: name, available, activeSpec: spec });
  },
}));
