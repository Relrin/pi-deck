import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { ThemeSpec } from "@pi-deck/core";
import type { TerminalTheme } from "../../../src/features/terminal/TerminalRenderer.js";

// Fake emulator handle that records every theme pushed to it after mount, plus the theme it was
// constructed with, so we can assert a live theme switch reaches the emulator.
interface FakeHandle {
  backend: "ghostty";
  setThemeArgs: TerminalTheme[];
  disposed: boolean;
  write(): void;
  resize(): void;
  fit(): { cols: number; rows: number };
  focus(): void;
  setTheme(theme: TerminalTheme): void;
  setFont(): void;
  getSelection(): string;
  scrollToBottom(): void;
  dispose(): void;
}

const handles: FakeHandle[] = [];
const mountThemes: TerminalTheme[] = [];

mock.module("../../../src/features/terminal/TerminalRenderer.js", () => ({
  mountTerminal: async (_container: HTMLElement, init: { theme: TerminalTheme }) => {
    mountThemes.push(init.theme);
    const handle: FakeHandle = {
      backend: "ghostty",
      setThemeArgs: [],
      disposed: false,
      write() {},
      resize() {},
      fit() {
        return { cols: 80, rows: 24 };
      },
      focus() {},
      setTheme(theme: TerminalTheme) {
        this.setThemeArgs.push(theme);
      },
      setFont() {},
      getSelection() {
        return "";
      },
      scrollToBottom() {},
      dispose() {
        this.disposed = true;
      },
    };
    handles.push(handle);
    return handle;
  },
}));

// Imported AFTER mock.module so TerminalView binds to the fake renderer.
const { render, act } = await import("../../utils");
const { TerminalView } = await import("../../../src/features/terminal/TerminalView");
const { useSessionsStore } = await import("../../../src/features/sessions/useSessionsStore");
const { useThemeStore } = await import("../../../src/theme/useThemeStore");

function fakeClient() {
  return {
    terminal: {
      open: async () => ({ terminalId: "X", cwd: "/tmp", shell: "/bin/zsh", cols: 80, rows: 24 }),
      snapshot: async () => ({ dataB64: "" }),
      resize: async () => ({}),
      write: async () => ({}),
      close: async () => ({}),
    },
  };
}

async function flush() {
  // Drain the mount effect's chain of awaits (mountTerminal → open → snapshot → subscribe).
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const tab = { tabId: "t1", cwd: "/tmp", terminalId: null, exited: false };

describe("TerminalView — live theme switch reaches the emulator", () => {
  beforeEach(() => {
    handles.length = 0;
    mountThemes.length = 0;
    // Start from a dark active theme.
    useThemeStore.setState({ activeName: "forge", activeSpec: undefined });
    // biome-ignore lint/suspicious/noExplicitAny: minimal client stub for the mount path
    useSessionsStore.setState({ client: fakeClient() as any });
  });

  afterEach(() => {
    useSessionsStore.setState({ client: undefined });
    useThemeStore.setState({ activeName: "forge", activeSpec: undefined });
  });

  test("changing the active theme pushes a refreshed theme to the mounted terminal", async () => {
    render(<TerminalView tab={tab} />);
    await flush();

    expect(handles.length).toBe(1);
    // Mounted with the dark theme (no CSS vars set in jsdom → dark fallback background).
    expect(mountThemes[0]?.background).toBe("#0b0b0d");

    // Simulate the `theme.changed` store update: switch to a light theme.
    await act(async () => {
      // Minimal spec stub — only `meta.kind` is read by `useTerminalTheme`.
      const activeSpec = { meta: { kind: "light" } } as unknown as ThemeSpec;
      useThemeStore.setState({ activeName: "default-light", activeSpec });
    });

    const live = handles.find((h) => !h.disposed);
    const pushed = live?.setThemeArgs ?? [];
    expect(pushed.length).toBeGreaterThan(0);
    // The emulator received the light theme (light fallback background), not the stale dark one.
    expect(pushed.at(-1)?.background).toBe("#ffffff");
  });
});
