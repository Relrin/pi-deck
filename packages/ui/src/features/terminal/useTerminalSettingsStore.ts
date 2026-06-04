import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * User-configurable terminal preferences, surfaced in Settings → Terminal and consumed when
 * opening a PTY / constructing the emulator. `shellPath: null` means "let the host pick the OS
 * default". `fontFamily: ""` means "use the UI mono token (`--font-mono`)".
 */
export type DefaultCwdMode = "session" | "last-used";

interface TerminalSettingsState {
  shellPath: string | null;
  fontFamily: string;
  fontSize: number;
  defaultCwd: DefaultCwdMode;
  setShellPath: (path: string | null) => void;
  setFontFamily: (family: string) => void;
  setFontSize: (size: number) => void;
  setDefaultCwd: (mode: DefaultCwdMode) => void;
}

export const TERMINAL_FONT_SIZE_MIN = 8;
export const TERMINAL_FONT_SIZE_MAX = 32;

export const useTerminalSettingsStore = create<TerminalSettingsState>()(
  persist(
    (set) => ({
      shellPath: null,
      fontFamily: "",
      fontSize: 13,
      defaultCwd: "session",
      setShellPath: (shellPath) => set({ shellPath }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setFontSize: (fontSize) =>
        set({
          fontSize: Math.min(
            Math.max(Math.round(fontSize), TERMINAL_FONT_SIZE_MIN),
            TERMINAL_FONT_SIZE_MAX,
          ),
        }),
      setDefaultCwd: (defaultCwd) => set({ defaultCwd }),
    }),
    { name: "pi-deck:terminal-settings:v1", version: 1 },
  ),
);
