import ghosttyWasmUrl from "ghostty-web/ghostty-vt.wasm?url";

/**
 * Thin adapter over the ghostty-web terminal emulator (WASM, chosen for its heavy-output perf).
 * The handle exposes an xterm-shaped API (`write`/`fit`/`resize`/`focus`/`dispose`). The renderer
 * library and its WASM are dynamically imported so they stay out of the main bundle until a
 * terminal opens.
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
  readonly backend: "ghostty";
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

let ghosttyLogsHandled = false;

/**
 * ghostty-vt's WASM routes every parser diagnostic straight to `console.log("[ghostty-vt]", ...)`
 * - there's no log-level or handler hook to override. On Windows, ConPTY enables win32-input-mode
 * (`CSI ?9001h`), which ghostty doesn't implement.
 *
 * Set `localStorage["pi-deck:terminal:ghostty-logs"] = "1"` to keep them when
 * debugging the emulator.
 */
function silenceGhosttyVtLogs(): void {
  if (ghosttyLogsHandled) return;
  ghosttyLogsHandled = true;
  try {
    if (globalThis.localStorage?.getItem("pi-deck:terminal:ghostty-logs") === "1") return;
  } catch {
    // localStorage unavailable (e.g. tests) — proceed with silencing.
  }
  const original = console.log.bind(console);
  console.log = (...args: unknown[]) => {
    if (args[0] === "[ghostty-vt]") return;
    original(...args);
  };
}

export async function mountTerminal(
  container: HTMLElement,
  init: TerminalRendererInit,
): Promise<TerminalRendererHandle> {
  silenceGhosttyVtLogs();
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
        // ghostty-web 0.4.0 ignores `options.theme` after open(), so apply to the
        // renderer directly and force a full redraw
        term.renderer?.setTheme(theme);
        if (term.renderer && term.wasmTerm) {
          term.renderer.render(term.wasmTerm, true, term.viewportY, term);
        }
      } catch {
        // Renderer not ready / proxy rejected the update — non-fatal.
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
