/**
 * Language-server definitions for the editor's LSP integration.
 *
 * pi-deck bundles no servers. Every server is detected on the PATH of the environment the
 * project lives in — the local machine, or the WSL distro for `\\wsl.localhost` projects —
 * and spawned from there. A missing server degrades the editor to its built-in completion
 * with the `installHint` surfaced in the status bar / settings, never an error.
 *
 * This file is also the **method allowlist** for the renderer-facing passthrough: the host
 * refuses any `lsp.request` / `lsp.notify` whose method isn't listed here, so the renderer
 * never gets arbitrary RPC into a server process. New LSP features must extend these sets
 * explicitly.
 */

export interface LanguageServerDef {
  /** Stable id used in protocol keys and settings ("typescript", "rust", ...). */
  id: string;
  /** Display label for settings / status surfaces. */
  label: string;
  /** LSP `languageId`s this server handles (sent in `textDocument/didOpen`). */
  languageIds: readonly string[];
  /** Bare command resolved on the environment's PATH. */
  command: string;
  args: readonly string[];
  /** One-line install instruction shown when the command is missing. */
  installHint: string;
}

/**
 * A user-defined server (Settings → Editor → Custom servers). Identical to a built-in def
 * plus its own extension → languageId mapping, since `LANGUAGE_ID_BY_EXTENSION` only covers
 * built-ins. Built-ins always win on conflicts — a custom def can't shadow a built-in
 * extension, languageId, or id.
 */
export interface CustomLanguageServerDef extends LanguageServerDef {
  /** File extensions, no dot. `"ex"` → `languageIds[0]`; `"heex:phoenix-heex"` overrides. */
  extensions: readonly string[];
}

export const LANGUAGE_SERVERS: readonly LanguageServerDef[] = [
  {
    id: "typescript",
    label: "TypeScript / JavaScript",
    languageIds: ["typescript", "typescriptreact", "javascript", "javascriptreact"],
    command: "typescript-language-server",
    args: ["--stdio"],
    installHint: "npm install -g typescript-language-server typescript",
  },
  {
    id: "css",
    label: "CSS / SCSS / Less",
    languageIds: ["css", "scss", "less"],
    command: "vscode-css-language-server",
    args: ["--stdio"],
    installHint: "npm install -g vscode-langservers-extracted",
  },
  {
    id: "html",
    label: "HTML",
    languageIds: ["html"],
    command: "vscode-html-language-server",
    args: ["--stdio"],
    installHint: "npm install -g vscode-langservers-extracted",
  },
  {
    id: "json",
    label: "JSON",
    languageIds: ["json", "jsonc"],
    command: "vscode-json-language-server",
    args: ["--stdio"],
    installHint: "npm install -g vscode-langservers-extracted",
  },
  {
    id: "python",
    label: "Python",
    languageIds: ["python"],
    command: "pyright-langserver",
    args: ["--stdio"],
    installHint: "npm install -g pyright",
  },
  {
    id: "rust",
    label: "Rust",
    languageIds: ["rust"],
    command: "rust-analyzer",
    args: [],
    installHint: "rustup component add rust-analyzer",
  },
  {
    id: "go",
    label: "Go",
    languageIds: ["go"],
    command: "gopls",
    args: [],
    installHint: "go install golang.org/x/tools/gopls@latest",
  },
];

/**
 * File extension → LSP `languageId`. Only languages with a server definition appear here —
 * this is the editor's "does LSP apply to this tab?" lookup, not a general language registry
 * (that's `packages/ui/src/features/editor/languages.ts`).
 */
export const LANGUAGE_ID_BY_EXTENSION: Readonly<Record<string, string>> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "typescriptreact",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascriptreact",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  htm: "html",
  json: "json",
  jsonc: "jsonc",
  py: "python",
  pyi: "python",
  rs: "rust",
  go: "go",
};

/**
 * Parse one `extensions` entry of a custom def: `"ex"` → `[ext, languageIds[0]]`,
 * `"heex:phoenix-heex"` → `[ext, override]`. Leading dots and case are normalised away.
 */
function parseCustomExtension(raw: string, def: CustomLanguageServerDef): [string, string] | null {
  const colon = raw.indexOf(":");
  const ext = (colon === -1 ? raw : raw.slice(0, colon)).trim().replace(/^\./, "").toLowerCase();
  const languageId = colon === -1 ? def.languageIds[0] : raw.slice(colon + 1).trim();
  if (!ext || !languageId) return null;
  return [ext, languageId];
}

/** Extension → languageId map across a set of custom defs (first def claiming an ext wins). */
export function customExtensionMap(
  customServers: readonly CustomLanguageServerDef[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const def of customServers) {
    for (const raw of def.extensions) {
      const parsed = parseCustomExtension(raw, def);
      if (parsed && !(parsed[0] in map)) map[parsed[0]] = parsed[1];
    }
  }
  return map;
}

/** LSP languageId for a filename, or null when no server definition covers it. */
export function languageIdForFile(
  fileName: string,
  customServers?: readonly CustomLanguageServerDef[],
): string | null {
  const slash = Math.max(fileName.lastIndexOf("/"), fileName.lastIndexOf("\\"));
  const base = slash >= 0 ? fileName.slice(slash + 1) : fileName;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return null;
  const ext = base.slice(dot + 1).toLowerCase();
  const builtin = LANGUAGE_ID_BY_EXTENSION[ext];
  if (builtin) return builtin;
  if (customServers && customServers.length > 0) {
    return customExtensionMap(customServers)[ext] ?? null;
  }
  return null;
}

/** The server definition that handles a languageId, or null. Built-ins win on overlap. */
export function serverForLanguageId(
  languageId: string,
  customServers?: readonly CustomLanguageServerDef[],
): LanguageServerDef | null {
  const builtin = LANGUAGE_SERVERS.find((def) => def.languageIds.includes(languageId));
  if (builtin) return builtin;
  return customServers?.find((def) => def.languageIds.includes(languageId)) ?? null;
}

export function serverById(serverId: string): LanguageServerDef | null {
  return LANGUAGE_SERVERS.find((def) => def.id === serverId) ?? null;
}

/** Client→server requests the host will forward. Everything else is rejected. */
export const LSP_REQUEST_ALLOWLIST: ReadonlySet<string> = new Set([
  "initialize",
  "shutdown",
  "textDocument/completion",
  "completionItem/resolve",
  "textDocument/hover",
  "textDocument/signatureHelp",
  "textDocument/definition",
  "textDocument/declaration",
  "textDocument/references",
  "textDocument/rename",
  "textDocument/prepareRename",
  "textDocument/formatting",
]);

/** Client→server notifications the host will forward (`$/cancelRequest` is intercepted). */
export const LSP_NOTIFY_ALLOWLIST: ReadonlySet<string> = new Set([
  "initialized",
  "exit",
  "textDocument/didOpen",
  "textDocument/didChange",
  "textDocument/didSave",
  "textDocument/didClose",
  "$/cancelRequest",
]);
