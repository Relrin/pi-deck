import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { TerminalTheme } from "../../../src/features/terminal/TerminalRenderer.js";

// The ghostty WASM url is a Vite `?url` import — stub it so the real renderer module loads.
mock.module("ghostty-web/ghostty-vt.wasm?url", () => ({ default: "wasm-url" }));

// Spies for the renderer the adapter is expected to drive directly. ghostty-web 0.4.0 ignores
// `options.theme` after open(), so the adapter must call `renderer.setTheme` and force a full
// repaint (`render(buffer, forceAll=true, ...)`) instead.
const setThemeCalls: unknown[] = [];
const renderCalls: Array<{ buffer: unknown; forceAll: unknown }> = [];

class FakeRenderer {
  setTheme(theme: unknown) {
    setThemeCalls.push(theme);
  }
  render(buffer: unknown, forceAll?: boolean) {
    renderCalls.push({ buffer, forceAll });
  }
}

const terminals: FakeTerminal[] = [];

class FakeTerminal {
  cols = 80;
  rows = 24;
  options: Record<string, unknown>;
  renderer = new FakeRenderer();
  wasmTerm = { id: "wasm-term" };
  viewportY = 0;
  constructor(options: Record<string, unknown>) {
    this.options = options;
    terminals.push(this);
  }
  loadAddon() {}
  open() {}
  onData() {
    return { dispose() {} };
  }
  onResize() {
    return { dispose() {} };
  }
  write() {}
  resize() {}
  focus() {}
  getSelection() {
    return "";
  }
  scrollToBottom() {}
  dispose() {}
}

class FakeFitAddon {
  fit() {}
}

const FakeGhostty = { load: async () => ({}) };

mock.module("ghostty-web", () => ({
  Ghostty: FakeGhostty,
  Terminal: FakeTerminal,
  FitAddon: FakeFitAddon,
}));

// Imported AFTER the mocks so the adapter binds to the fakes.
const { mountTerminal } = await import("../../../src/features/terminal/TerminalRenderer.js");

function makeTheme(background: string): TerminalTheme {
  return {
    background,
    foreground: "#ffffff",
    cursor: "#ff8800",
    black: "#000000",
    red: "#ff0000",
    green: "#00ff00",
    yellow: "#ffff00",
    blue: "#0000ff",
    magenta: "#ff00ff",
    cyan: "#00ffff",
    white: "#cccccc",
    brightBlack: "#666666",
    brightRed: "#ff6666",
    brightGreen: "#66ff66",
    brightYellow: "#ffff66",
    brightBlue: "#6666ff",
    brightMagenta: "#ff66ff",
    brightCyan: "#66ffff",
    brightWhite: "#ffffff",
  };
}

describe("TerminalRenderer ghostty backend — live theme switch", () => {
  beforeEach(() => {
    terminals.length = 0;
    setThemeCalls.length = 0;
    renderCalls.length = 0;
  });

  test("setTheme repaints the live grid with the new palette", async () => {
    const initialTheme = makeTheme("#0b0b0d");
    const handle = await mountTerminal(document.createElement("div"), {
      fontFamily: "monospace",
      fontSize: 13,
      theme: initialTheme,
      onData: () => {},
      onResize: () => {},
    });
    expect(handle.backend).toBe("ghostty");

    const newTheme = makeTheme("#ffffff");
    handle.setTheme(newTheme);

    // Applied straight to the renderer…
    expect(setThemeCalls).toEqual([newTheme]);
    // …and a forced full repaint so already-painted rows pick up the new colours.
    expect(renderCalls.some((c) => c.forceAll === true)).toBe(true);
  });

  test("does not rely on the no-op options.theme proxy", async () => {
    const initialTheme = makeTheme("#0b0b0d");
    const handle = await mountTerminal(document.createElement("div"), {
      fontFamily: "monospace",
      fontSize: 13,
      theme: initialTheme,
      onData: () => {},
      onResize: () => {},
    });

    const newTheme = makeTheme("#ffffff");
    handle.setTheme(newTheme);

    // options.theme is only read at open(); reassigning it post-open is ignored by ghostty-web,
    // so the adapter must leave it alone (and avoid the library's "not yet supported" warning).
    expect(terminals[0]?.options.theme).toBe(initialTheme);
  });
});
