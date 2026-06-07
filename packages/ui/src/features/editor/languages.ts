import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { yaml } from "@codemirror/lang-yaml";
import type { Extension } from "@codemirror/state";

/**
 * Per-language presentation + CodeMirror support, keyed by file extension. The badge is a short mono
 * label tinted with an existing theme token. `support` is the CodeMirror language
 * extension; an empty array means "plain text" (no grammar, still editable + highlightable-as-text).
 */
export interface LanguageInfo {
  /** Status-bar label, e.g. "TypeScript JSX". */
  label: string;
  /** CodeMirror language extension(s); `[]` for plain text. */
  support: Extension;
  /** Editor-tab type badge. */
  badge: { text: string; color: string };
}

interface LangDef {
  label: string;
  support: () => Extension;
  badge: { text: string; color: string };
}

const TS: LangDef = {
  label: "TypeScript",
  support: () => javascript({ typescript: true }),
  badge: { text: "TS", color: "var(--info)" },
};
const TSX: LangDef = {
  label: "TypeScript JSX",
  support: () => javascript({ typescript: true, jsx: true }),
  badge: { text: "TSX", color: "var(--info)" },
};
const JS: LangDef = {
  label: "JavaScript",
  support: () => javascript(),
  badge: { text: "JS", color: "var(--mod)" },
};
const JSX: LangDef = {
  label: "JavaScript JSX",
  support: () => javascript({ jsx: true }),
  badge: { text: "JSX", color: "var(--info)" },
};
const JSON_: LangDef = {
  label: "JSON",
  support: () => json(),
  badge: { text: "{ }", color: "var(--mod)" },
};
const CSS: LangDef = {
  label: "CSS",
  support: () => css(),
  badge: { text: "CSS", color: "var(--accent)" },
};
const HTML: LangDef = {
  label: "HTML",
  support: () => html(),
  badge: { text: "HTML", color: "var(--accent)" },
};
const MD: LangDef = {
  label: "Markdown",
  support: () => markdown(),
  badge: { text: "MD", color: "var(--ink-2)" },
};
const PY: LangDef = {
  label: "Python",
  support: () => python(),
  badge: { text: "PY", color: "var(--add)" },
};
const RS: LangDef = {
  label: "Rust",
  support: () => rust(),
  badge: { text: "RS", color: "var(--del)" },
};
const YAML: LangDef = {
  label: "YAML",
  support: () => yaml(),
  badge: { text: "YML", color: "var(--mod)" },
};

const BY_EXT: Record<string, LangDef> = {
  ts: TS,
  mts: TS,
  cts: TS,
  tsx: TSX,
  js: JS,
  cjs: JS,
  mjs: JS,
  jsx: JSX,
  json: JSON_,
  jsonc: JSON_,
  css: CSS,
  scss: CSS,
  less: CSS,
  html: HTML,
  htm: HTML,
  md: MD,
  markdown: MD,
  py: PY,
  pyi: PY,
  rs: RS,
  yaml: YAML,
  yml: YAML,
};

/** Lowercased final extension of a filename, or "" when there is none (e.g. `.gitignore`). */
function extOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return ""; // no dot, or dotfile with no extension
  return fileName.slice(dot + 1).toLowerCase();
}

/** Resolve language presentation + CodeMirror support for a filename. Falls back to plain text. */
export function languageForFile(fileName: string): LanguageInfo {
  const ext = extOf(fileName);
  const def = BY_EXT[ext];
  if (def) return { label: def.label, support: def.support(), badge: def.badge };
  return {
    label: "Plain Text",
    support: [],
    badge: { text: ext ? ext.slice(0, 3).toUpperCase() : "TXT", color: "var(--ink-2)" },
  };
}

/** Tab badge only — cheaper than resolving the full language support for the tab strip. */
export function badgeForFile(fileName: string): { text: string; color: string } {
  const def = BY_EXT[extOf(fileName)];
  if (def) return def.badge;
  const ext = extOf(fileName);
  return { text: ext ? ext.slice(0, 3).toUpperCase() : "TXT", color: "var(--ink-2)" };
}
