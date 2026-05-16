import type { ThemeSpec } from "@pi-deck/core";

/**
 * Best-effort adapter from a VS Code colour theme JSON into a pi-deck `ThemeSpec`.
 *
 * VS Code themes carry a flat `colors` map (UI chrome) and an array of `tokenColors` (syntax).
 * We map a handful of well-known UI keys onto our surface/ink/accent vocabulary; anything we
 * cannot derive falls back to the CSS defaults in `tokens.css`. The raw JSON is also returned
 * so the Shiki bridge can pass it through unchanged for syntax highlighting.
 */

export interface VSCodeThemeJson {
  name?: string;
  type?: "dark" | "light";
  colors?: Record<string, string>;
  tokenColors?: Array<{
    scope?: string | string[];
    settings?: { foreground?: string; background?: string; fontStyle?: string };
  }>;
  semanticTokenColors?: Record<string, unknown>;
}

export interface AdaptedTheme {
  spec: ThemeSpec;
  raw: VSCodeThemeJson;
}

/** Pick the first defined colour from a priority list of VS Code keys. */
function pick(colors: Record<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = colors[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

/** Mix two hex colours linearly. `t` is the weight of `b`. */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return a;
  const r = Math.round(pa.r * (1 - t) + pb.r * t);
  const g = Math.round(pa.g * (1 - t) + pb.g * t);
  const bl = Math.round(pa.b * (1 - t) + pb.b * t);
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(input: string): { r: number; g: number; b: number; a: number } | null {
  let s = input.trim();
  if (s.startsWith("#")) s = s.slice(1);
  if (s.length === 3)
    s = s
      .split("")
      .map((c) => c + c)
      .join("");
  if (s.length === 6) s += "ff";
  if (s.length !== 8) return null;
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  const a = parseInt(s.slice(6, 8), 16) / 255;
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b, a };
}

/** Append an alpha channel to a hex colour. */
function withAlpha(hex: string, alpha: number): string {
  const p = parseHex(hex);
  if (!p) return hex;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${[p.r, p.g, p.b].map((n) => n.toString(16).padStart(2, "0")).join("")}${a}`;
}

export function adaptVSCodeTheme(json: unknown): AdaptedTheme {
  const raw = (json ?? {}) as VSCodeThemeJson;
  const colors = raw.colors ?? {};
  const kind: "dark" | "light" = raw.type === "light" ? "light" : "dark";
  const isDark = kind === "dark";

  const bg0 = pick(colors, "editor.background") ?? (isDark ? "#0e0f12" : "#fafafa");
  const bg1 =
    pick(colors, "sideBar.background", "panel.background") ??
    mixHex(bg0, isDark ? "#ffffff" : "#000000", 0.04);
  const bg2 =
    pick(colors, "editorWidget.background", "tab.activeBackground") ??
    mixHex(bg0, isDark ? "#ffffff" : "#000000", 0.08);
  const bg3 =
    pick(colors, "list.hoverBackground", "tab.hoverBackground") ??
    mixHex(bg0, isDark ? "#ffffff" : "#000000", 0.12);
  const bgInset =
    pick(colors, "input.background", "editor.lineHighlightBackground") ??
    mixHex(bg0, isDark ? "#000000" : "#ffffff", 0.06);

  const line =
    pick(colors, "panel.border", "editorGroup.border", "tab.border") ??
    withAlpha(isDark ? "#ffffff" : "#000000", 0.15);
  const lineStrong =
    pick(colors, "contrastBorder", "focusBorder") ?? withAlpha(isDark ? "#ffffff" : "#000000", 0.3);

  const ink0 = pick(colors, "editor.foreground", "foreground") ?? (isDark ? "#e7e9ee" : "#1a1a1a");
  const ink1 =
    pick(colors, "descriptionForeground", "list.deemphasizedForeground") ?? mixHex(ink0, bg0, 0.25);
  const ink2 = pick(colors, "disabledForeground") ?? mixHex(ink0, bg0, 0.5);
  const ink3 = mixHex(ink0, bg0, 0.65);

  const accent =
    pick(
      colors,
      "focusBorder",
      "button.background",
      "list.activeSelectionBackground",
      "textLink.foreground",
    ) ?? (isDark ? "#6aa1ff" : "#0066cc");

  const add =
    pick(colors, "gitDecoration.addedResourceForeground", "diffEditor.insertedTextBackground") ??
    "#6fcf97";
  const del =
    pick(colors, "gitDecoration.deletedResourceForeground", "errorForeground") ?? "#f47174";
  const mod = pick(colors, "gitDecoration.modifiedResourceForeground") ?? "#f2c94c";
  const info =
    pick(colors, "editorInfo.foreground", "notificationsInfoIcon.foreground") ?? "#74b9ff";
  const warn =
    pick(colors, "editorWarning.foreground", "notificationsWarningIcon.foreground") ?? "#f2c94c";

  const spec: ThemeSpec = {
    meta: {
      name: raw.name ?? "vscode-imported",
      kind,
      accent: "custom",
    },
    "bg-0": bg0,
    "bg-1": bg1,
    "bg-2": bg2,
    "bg-3": bg3,
    "bg-inset": bgInset,
    line,
    "line-strong": lineStrong,
    "ink-0": ink0,
    "ink-1": ink1,
    "ink-2": ink2,
    "ink-3": ink3,
    accent,
    "accent-soft": withAlpha(accent, 0.14),
    "accent-line": withAlpha(accent, 0.35),
    "accent-ink": isDark ? mixHex(accent, "#000000", 0.7) : mixHex(accent, "#ffffff", 0.85),
    add,
    "add-soft": withAlpha(add, 0.12),
    del,
    "del-soft": withAlpha(del, 0.12),
    mod,
    "mod-soft": withAlpha(mod, 0.12),
    info,
    warn,
  };

  return { spec, raw };
}
