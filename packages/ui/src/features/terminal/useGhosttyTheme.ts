import { useEffect, useState } from "react";
import { useThemeStore } from "../../theme/useThemeStore.js";
import type { TerminalTheme } from "./TerminalRenderer.js";

/**
 * Bridges the active pi-deck theme into the terminal emulator's colour scheme. The ANSI-16
 * palette reads the `--term-*` tokens; their tokens.css defaults chain onto the semantic
 * vocabulary (`--del`, `--add`, `--info`, …), so themes without a term section keep the
 * historical derived look. Base colours (bg/fg/cursor/selection) stay derived from UI tokens.
 * The hardcoded palettes below are last-resort fallbacks for non-DOM environments.
 *
 * Recomputed whenever the active theme changes (the loader has already written the new CSS
 * variables to `:root` by then, so reading computed styles yields fresh values).
 */

interface AnsiDefaults {
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

const DARK_ANSI: AnsiDefaults = {
  black: "#2b2b2b",
  red: "#e06c75",
  green: "#98c379",
  yellow: "#e5c07b",
  blue: "#61afef",
  magenta: "#c678dd",
  cyan: "#56b6c2",
  white: "#cdd0d6",
  brightBlack: "#5c6370",
  brightRed: "#ff7a85",
  brightGreen: "#b5e890",
  brightYellow: "#ffd68a",
  brightBlue: "#7cc5ff",
  brightMagenta: "#d99aee",
  brightCyan: "#6cd3df",
  brightWhite: "#ffffff",
};

const LIGHT_ANSI: AnsiDefaults = {
  black: "#2b2b2b",
  red: "#c0392b",
  green: "#3f8f3f",
  yellow: "#9a6b00",
  blue: "#2563c0",
  magenta: "#9b3fb0",
  cyan: "#1c8a99",
  white: "#3a3a3a",
  brightBlack: "#7a7a7a",
  brightRed: "#d44637",
  brightGreen: "#4aa14a",
  brightYellow: "#b07d00",
  brightBlue: "#2f6fd6",
  brightMagenta: "#ad4cc2",
  brightCyan: "#22a0b0",
  brightWhite: "#1a1a1a",
};

let probe: HTMLDivElement | null = null;

/** Normalise any CSS colour (hex / rgb / color-mix / oklch) to a concrete `rgb(...)` string. */
function normalizeColor(value: string, fallback: string): string {
  const input = value.trim();
  if (!input) return fallback;
  if (typeof document === "undefined") return fallback;
  try {
    if (!probe) {
      probe = document.createElement("div");
      probe.style.display = "none";
      document.body.appendChild(probe);
    }
    probe.style.color = "";
    probe.style.color = input;
    if (!probe.style.color) return fallback;
    return getComputedStyle(probe).color || fallback;
  } catch {
    return fallback;
  }
}

function readVar(name: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function buildTerminalTheme(kind: "light" | "dark" | undefined): TerminalTheme {
  const dark = kind !== "light";
  const ansi = dark ? DARK_ANSI : LIGHT_ANSI;
  const v = (name: string, fallback: string) => normalizeColor(readVar(name), fallback);
  return {
    background: v("--bg-0", dark ? "#0b0b0d" : "#ffffff"),
    foreground: v("--ink-0", dark ? "#e6e6e6" : "#1a1a1a"),
    cursor: v("--accent", dark ? "#e6a23c" : "#c05621"),
    cursorAccent: v("--bg-0", dark ? "#0b0b0d" : "#ffffff"),
    selectionBackground: v("--accent-soft", dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)"),
    black: v("--term-black", ansi.black),
    red: v("--term-red", ansi.red),
    green: v("--term-green", ansi.green),
    yellow: v("--term-yellow", ansi.yellow),
    blue: v("--term-blue", ansi.blue),
    magenta: v("--term-magenta", ansi.magenta),
    cyan: v("--term-cyan", ansi.cyan),
    white: v("--term-white", ansi.white),
    brightBlack: v("--term-bright-black", ansi.brightBlack),
    brightRed: v("--term-bright-red", ansi.brightRed),
    brightGreen: v("--term-bright-green", ansi.brightGreen),
    brightYellow: v("--term-bright-yellow", ansi.brightYellow),
    brightBlue: v("--term-bright-blue", ansi.brightBlue),
    brightMagenta: v("--term-bright-magenta", ansi.brightMagenta),
    brightCyan: v("--term-bright-cyan", ansi.brightCyan),
    brightWhite: v("--term-bright-white", ansi.brightWhite),
  };
}

export function useTerminalTheme(): TerminalTheme {
  const activeName = useThemeStore((s) => s.activeName);
  const kind = useThemeStore((s) => s.activeSpec?.meta?.kind);
  const [theme, setTheme] = useState<TerminalTheme>(() => buildTerminalTheme(kind));
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeName is the re-compute signal; the CSS vars it implies are read imperatively, not captured as deps.
  useEffect(() => {
    setTheme(buildTerminalTheme(kind));
  }, [activeName, kind]);
  return theme;
}
