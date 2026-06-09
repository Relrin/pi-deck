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

/** LSP languageId for a filename, or null when no server definition covers it. */
export function languageIdForFile(fileName: string): string | null {
  const slash = Math.max(fileName.lastIndexOf("/"), fileName.lastIndexOf("\\"));
  const base = slash >= 0 ? fileName.slice(slash + 1) : fileName;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return null;
  const ext = base.slice(dot + 1).toLowerCase();
  return LANGUAGE_ID_BY_EXTENSION[ext] ?? null;
}

/** The server definition that handles a languageId, or null. */
export function serverForLanguageId(languageId: string): LanguageServerDef | null {
  return LANGUAGE_SERVERS.find((def) => def.languageIds.includes(languageId)) ?? null;
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
