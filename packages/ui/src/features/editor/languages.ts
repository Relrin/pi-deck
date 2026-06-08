import { cpp } from "@codemirror/lang-cpp";
import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sass } from "@codemirror/lang-sass";
import { sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import { StreamLanguage } from "@codemirror/language";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { erlang } from "@codemirror/legacy-modes/mode/erlang";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { protobuf } from "@codemirror/legacy-modes/mode/protobuf";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import type { Extension } from "@codemirror/state";
import { elixir } from "codemirror-lang-elixir";

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
const SCSS: LangDef = {
  label: "SCSS",
  support: () => sass({ indented: false }),
  badge: { text: "SCSS", color: "var(--accent)" },
};
const SASS: LangDef = {
  label: "Sass",
  support: () => sass({ indented: true }),
  badge: { text: "SASS", color: "var(--accent)" },
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
const CPP: LangDef = {
  label: "C++",
  support: () => cpp(),
  badge: { text: "C++", color: "var(--info)" },
};
const C: LangDef = {
  label: "C",
  support: () => cpp(),
  badge: { text: "C", color: "var(--info)" },
};
const GO: LangDef = {
  label: "Go",
  support: () => go(),
  badge: { text: "GO", color: "var(--info)" },
};
const SQL_: LangDef = {
  label: "SQL",
  support: () => sql(),
  badge: { text: "SQL", color: "var(--warn)" },
};
const LUA: LangDef = {
  label: "Lua",
  support: () => StreamLanguage.define(lua),
  badge: { text: "LUA", color: "var(--info)" },
};
const ERLANG: LangDef = {
  label: "Erlang",
  support: () => StreamLanguage.define(erlang),
  badge: { text: "ERL", color: "var(--del)" },
};
const ELIXIR: LangDef = {
  label: "Elixir",
  support: () => elixir(),
  badge: { text: "EX", color: "var(--accent)" },
};
const SHELL: LangDef = {
  label: "Shell",
  support: () => StreamLanguage.define(shell),
  badge: { text: "SH", color: "var(--add)" },
};
const DOCKER: LangDef = {
  label: "Dockerfile",
  support: () => StreamLanguage.define(dockerFile),
  badge: { text: "DOCK", color: "var(--info)" },
};
const PROTO: LangDef = {
  label: "Protocol Buffers",
  support: () => StreamLanguage.define(protobuf),
  badge: { text: "PB", color: "var(--mod)" },
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
  scss: SCSS,
  sass: SASS,
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
  // C / C++ (one grammar, distinct labels). `.h` defaults to C; C++ headers use .hpp/.hh/.hxx.
  c: C,
  h: C,
  cpp: CPP,
  cc: CPP,
  cxx: CPP,
  hpp: CPP,
  hh: CPP,
  hxx: CPP,
  go: GO,
  sql: SQL_,
  lua: LUA,
  erl: ERLANG,
  hrl: ERLANG,
  ex: ELIXIR,
  exs: ELIXIR,
  sh: SHELL,
  bash: SHELL,
  zsh: SHELL,
  ksh: SHELL,
  dockerfile: DOCKER,
  proto: PROTO,
};

/** Languages identified by whole filename rather than extension (e.g. `Dockerfile`). */
const BY_NAME: Record<string, LangDef> = {
  dockerfile: DOCKER,
  containerfile: DOCKER,
};

/** Final path segment (handles both `/` and `\` separators), lowercased. */
function baseName(path: string): string {
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return (slash >= 0 ? path.slice(slash + 1) : path).toLowerCase();
}

/** Lowercased final extension of a filename, or "" when there is none (e.g. `.gitignore`). */
function extOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return ""; // no dot, or dotfile with no extension
  return fileName.slice(dot + 1).toLowerCase();
}

/** Resolve the language def for a filename: whole-name match first (Dockerfile), then extension. */
function defForFile(fileName: string): LangDef | undefined {
  const base = baseName(fileName);
  const named = BY_NAME[base] ?? (base.startsWith("dockerfile.") ? DOCKER : undefined);
  return named ?? BY_EXT[extOf(fileName)];
}

/** Resolve language presentation + CodeMirror support for a filename. Falls back to plain text. */
export function languageForFile(fileName: string): LanguageInfo {
  const def = defForFile(fileName);
  if (def) return { label: def.label, support: def.support(), badge: def.badge };
  const ext = extOf(fileName);
  return {
    label: "Plain Text",
    support: [],
    badge: { text: ext ? ext.slice(0, 3).toUpperCase() : "TXT", color: "var(--ink-2)" },
  };
}

/** Tab badge only — cheaper than resolving the full language support for the tab strip. */
export function badgeForFile(fileName: string): { text: string; color: string } {
  const def = defForFile(fileName);
  if (def) return def.badge;
  const ext = extOf(fileName);
  return { text: ext ? ext.slice(0, 3).toUpperCase() : "TXT", color: "var(--ink-2)" };
}
