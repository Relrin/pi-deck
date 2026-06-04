import ghosttyWasmUrl from "ghostty-web/ghostty-vt.wasm?url";

/**
 * Thin adapter over a web terminal emulator. ghostty-web is the default (better heavy-output
 * perf); if its WASM fails to load we transparently fall back to xterm.js. Both expose an
 * xterm-shaped API (`open`/`write`/`onData`/`loadAddon(FitAddon)`/`resize`/`dispose`), so the
 * two implementations differ only in how they're constructed. The renderer libraries are
 * dynamically imported so they (and the WASM) stay out of the main bundle until a terminal opens.
 */

export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent?: string;
  selectionBackground?: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface TerminalRendererInit {
  fontFamily: string;
  fontSize: number;
  theme: TerminalTheme;
  scrollback?: number;
  /** User keystrokes / pastes the emulator produced — forward to the PTY. */
  onData: (data: string) => void;
  /** Emulator measured a new grid size (after `fit()`) — forward to the PTY. */
  onResize: (cols: number, rows: number) => void;
}

export interface TerminalRendererHandle {
  readonly backend: "ghostty" | "xterm";
  write(data: string): void;
  resize(cols: number, rows: number): void;
  /** Re-measure and resize to the container; returns the new grid, or null if unmeasurable. */
  fit(): { cols: number; rows: number } | null;
  focus(): void;
  setTheme(theme: TerminalTheme): void;
  setFont(family: string, size: number): void;
  getSelection(): string;
  scrollToBottom(): void;
  dispose(): void;
}

const DEFAULT_SCROLLBACK = 5000;

/** Cache the loaded ghostty WASM instance — it's expensive and shareable across terminals. */
let ghosttyLoad: Promise<unknown> | null = null;

export async function mountTerminal(
  container: HTMLElement,
  init: TerminalRendererInit,
): Promise<TerminalRendererHandle> {
  try {
    return await mountGhostty(container, init);
  } catch (err) {
    console.warn("[terminal] ghostty-web unavailable — falling back to xterm.js:", err);
    return await mountXterm(container, init);
  }
}

async function mountGhostty(
  container: HTMLElement,
  init: TerminalRendererInit,
): Promise<TerminalRendererHandle> {
  const { Ghostty, Terminal, FitAddon } = await import("ghostty-web");
  if (!ghosttyLoad) ghosttyLoad = Ghostty.load(ghosttyWasmUrl);
  const ghostty = (await ghosttyLoad) as Awaited<ReturnType<typeof Ghostty.load>>;

  const term = new Terminal({
    ghostty,
    fontFamily: init.fontFamily,
    fontSize: init.fontSize,
    theme: init.theme,
    cursorBlink: true,
    scrollback: init.scrollback ?? DEFAULT_SCROLLBACK,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(container);
  const disposers = [
    term.onData(init.onData),
    term.onResize(({ cols, rows }) => init.onResize(cols, rows)),
  ];

  return {
    backend: "ghostty",
    write: (data) => term.write(data),
    resize: (cols, rows) => term.resize(cols, rows),
    fit: () => {
      try {
        fit.fit();
      } catch {
        return null;
      }
      return { cols: term.cols, rows: term.rows };
    },
    focus: () => term.focus(),
    setTheme: (theme) => {
      try {
        term.options.theme = theme;
      } catch {
        // Options proxy rejected the update — non-fatal.
      }
    },
    setFont: (family, size) => {
      try {
        term.options.fontFamily = family;
        term.options.fontSize = size;
      } catch {
        // ignore
      }
    },
    getSelection: () => term.getSelection(),
    scrollToBottom: () => term.scrollToBottom(),
    dispose: () => {
      for (const d of disposers) d.dispose();
      term.dispose();
    },
  };
}

async function mountXterm(
  container: HTMLElement,
  init: TerminalRendererInit,
): Promise<TerminalRendererHandle> {
  const [{ Terminal }, { FitAddon }] = await Promise.all([
    import("@xterm/xterm"),
    import("@xterm/addon-fit"),
  ]);
  await import("@xterm/xterm/css/xterm.css");

  const term = new Terminal({
    fontFamily: init.fontFamily,
    fontSize: init.fontSize,
    theme: init.theme,
    cursorBlink: true,
    scrollback: init.scrollback ?? DEFAULT_SCROLLBACK,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(container);
  const disposers = [
    term.onData(init.onData),
    term.onResize(({ cols, rows }) => init.onResize(cols, rows)),
  ];

  return {
    backend: "xterm",
    write: (data) => term.write(data),
    resize: (cols, rows) => term.resize(cols, rows),
    fit: () => {
      try {
        fit.fit();
      } catch {
        return null;
      }
      return { cols: term.cols, rows: term.rows };
    },
    focus: () => term.focus(),
    setTheme: (theme) => {
      term.options.theme = theme;
    },
    setFont: (family, size) => {
      term.options.fontFamily = family;
      term.options.fontSize = size;
    },
    getSelection: () => term.getSelection(),
    scrollToBottom: () => term.scrollToBottom(),
    dispose: () => {
      for (const d of disposers) d.dispose();
      term.dispose();
    },
  };
}
