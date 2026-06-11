import type { ThemeSpec } from "../../protocol/theme.js";

/**
 * Best-effort adapter from a VS Code colour theme JSON into a pi-deck `ThemeSpec`.
 *
 * VS Code themes carry a flat `colors` map (UI chrome) and an array of `tokenColors` (syntax).
 * We map well-known UI keys onto our surface/ink/accent vocabulary, TextMate scopes from
 * `tokenColors` onto the `syn-*` palette, and `terminal.ansi*` onto `term-*`; anything we
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

interface TokenRule {
  selector: string;
  foreground?: string;
  fontStyle?: string;
  /** Position in the original tokenColors array — last rule wins specificity ties. */
  index: number;
}

/**
 * Flatten `tokenColors` into one entry per simple selector. Comma lists are split; descendant
 * selectors (containing spaces) and empty-scope global rules are skipped — best effort, in
 * keeping with the rest of this adapter.
 */
export function flattenTokenColors(tokenColors: VSCodeThemeJson["tokenColors"]): TokenRule[] {
  const rules: TokenRule[] = [];
  (tokenColors ?? []).forEach((entry, index) => {
    const { scope, settings } = entry ?? {};
    if (!settings) return;
    const foreground = typeof settings.foreground === "string" ? settings.foreground : undefined;
    const fontStyle = typeof settings.fontStyle === "string" ? settings.fontStyle : undefined;
    if (foreground === undefined && fontStyle === undefined) return;
    const parts = (Array.isArray(scope) ? scope : typeof scope === "string" ? [scope] : [])
      .flatMap((s) => s.split(","))
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !/\s/.test(s));
    for (const selector of parts) rules.push({ selector, foreground, fontStyle, index });
  });
  return rules;
}

/**
 * Resolve the style for a TextMate scope: a selector matches iff it equals the scope or is a
 * dotted prefix of it. `foreground` and `fontStyle` are resolved independently (TextMate rules
 * cascade per property) — longest selector wins, ties go to the later rule.
 */
export function resolveScope(
  rules: TokenRule[],
  scope: string,
): { foreground?: string; fontStyle?: string } | undefined {
  let fg: TokenRule | undefined;
  let fs: TokenRule | undefined;
  const better = (candidate: TokenRule, best: TokenRule | undefined): boolean =>
    !best ||
    candidate.selector.length > best.selector.length ||
    (candidate.selector.length === best.selector.length && candidate.index >= best.index);
  for (const rule of rules) {
    if (scope !== rule.selector && !scope.startsWith(`${rule.selector}.`)) continue;
    if (rule.foreground !== undefined && better(rule, fg)) fg = rule;
    if (rule.fontStyle !== undefined && better(rule, fs)) fs = rule;
  }
  if (!fg && !fs) return undefined;
  return { foreground: fg?.foreground, fontStyle: fs?.fontStyle };
}

/** First scope in priority order that resolves to a foreground colour. */
function pickToken(rules: TokenRule[], ...scopes: string[]): string | undefined {
  for (const scope of scopes) {
    const resolved = resolveScope(rules, scope);
    if (resolved?.foreground) return resolved.foreground;
  }
  return undefined;
}

/** Map `tokenColors` onto the `syn-*` palette. Unmatched tokens are omitted (CSS defaults win). */
function adaptTokenColors(tokenColors: VSCodeThemeJson["tokenColors"]): ThemeSpec {
  const rules = flattenTokenColors(tokenColors);
  const syn: ThemeSpec = {};
  const set = (key: string, ...scopes: string[]) => {
    const fg = pickToken(rules, ...scopes);
    if (fg) syn[key] = fg;
  };
  set("syn-keyword", "keyword.control", "keyword", "storage.modifier", "storage");
  set("syn-string", "string");
  set("syn-regexp", "string.regexp", "constant.character.escape");
  set("syn-comment", "comment");
  set("syn-doc-comment", "comment.block.documentation");
  set("syn-number", "constant.numeric", "constant");
  set("syn-constant", "constant.language", "variable.other.constant", "constant");
  set("syn-type", "entity.name.type", "support.type", "storage.type");
  set("syn-class", "entity.name.class", "entity.name.type.class", "support.class");
  set("syn-function", "entity.name.function", "support.function");
  set("syn-macro", "entity.name.function.macro", "entity.name.function.preprocessor");
  set("syn-variable", "variable.other.readwrite", "variable");
  set("syn-parameter", "variable.parameter");
  set(
    "syn-property",
    "variable.other.property",
    "support.type.property-name",
    "meta.object-literal.key",
  );
  set("syn-attribute", "entity.other.attribute-name");
  set("syn-tag", "entity.name.tag");
  set("syn-operator", "keyword.operator");
  set("syn-punctuation", "punctuation");
  set("syn-meta", "meta.preprocessor", "storage.type.annotation", "entity.name.function.decorator");
  set("syn-link", "markup.underline.link", "string.other.link");
  set("syn-heading", "markup.heading", "entity.name.section");
  set("syn-invalid", "invalid");

  const comment = resolveScope(rules, "comment");
  if (comment?.fontStyle !== undefined) {
    syn["syn-comment-style"] = comment.fontStyle.includes("italic") ? "italic" : "normal";
  }
  return syn;
}

const ANSI_KEYS = [
  ["term-black", "terminal.ansiBlack"],
  ["term-red", "terminal.ansiRed"],
  ["term-green", "terminal.ansiGreen"],
  ["term-yellow", "terminal.ansiYellow"],
  ["term-blue", "terminal.ansiBlue"],
  ["term-magenta", "terminal.ansiMagenta"],
  ["term-cyan", "terminal.ansiCyan"],
  ["term-white", "terminal.ansiWhite"],
  ["term-bright-black", "terminal.ansiBrightBlack"],
  ["term-bright-red", "terminal.ansiBrightRed"],
  ["term-bright-green", "terminal.ansiBrightGreen"],
  ["term-bright-yellow", "terminal.ansiBrightYellow"],
  ["term-bright-blue", "terminal.ansiBrightBlue"],
  ["term-bright-magenta", "terminal.ansiBrightMagenta"],
  ["term-bright-cyan", "terminal.ansiBrightCyan"],
  ["term-bright-white", "terminal.ansiBrightWhite"],
] as const;

/** Map `terminal.ansi*` workbench colours onto the `term-*` palette; absent keys are omitted. */
function adaptTerminalColors(colors: Record<string, string>): ThemeSpec {
  const term: ThemeSpec = {};
  for (const [token, vscodeKey] of ANSI_KEYS) {
    const value = pick(colors, vscodeKey);
    if (value) term[token] = value;
  }
  return term;
}

export function adaptVSCodeTheme(json: unknown, fallbackName?: string): AdaptedTheme {
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

  const resolvedName =
    (typeof raw.name === "string" && raw.name.trim()) || fallbackName || "vscode-imported";

  const spec: ThemeSpec = {
    meta: {
      name: resolvedName,
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
    ...adaptTokenColors(raw.tokenColors),
    ...adaptTerminalColors(colors),
  };

  return { spec, raw };
}
