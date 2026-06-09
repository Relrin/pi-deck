import { LSPClient, languageServerExtensions } from "@codemirror/lsp-client";
import { languageIdForFile, serverForLanguageId } from "@pi-deck/core/lsp/server-defs.js";
import { deckPathToUri, type LspMapping, uriToDeckPath } from "@pi-deck/core/lsp/uri.js";
import { create } from "zustand";
import { useNotificationStore } from "../../_status/useNotificationStore.js";
import { useSessionsStore } from "../../sessions/useSessionsStore.js";
import { createLspTransport, disposeLspTransport } from "./transport.js";
import { useLspSettingsStore } from "./useLspSettingsStore.js";
import { PidLspWorkspace } from "./workspace.js";

/** Renderer-side request timeout. Cold tsserver starts can exceed lsp-client's 3 s default. */
const REQUEST_TIMEOUT_MS = 10_000;
/** Don't auto-respawn a crashed server more often than this (no crash loops). */
const CRASH_RETRY_COOLDOWN_MS = 10_000;

export type LspServerUiStatus = "starting" | "ready" | "missing" | "crashed" | "disabled";

export interface LspServerState {
  /** Host passthrough key: `${projectId}:${serverId}`. */
  key: string;
  serverId: string;
  status: LspServerUiStatus;
  installHint?: string;
  mapping?: LspMapping;
  rootUri?: string;
  message?: string;
  /** Set when status is "crashed"; gates the auto-respawn cooldown. */
  crashedAt?: number;
}

export interface LspDiagnosticCounts {
  errors: number;
  warnings: number;
}

interface EnsureTabArgs {
  projectId: string;
  fileName: string;
}

interface LspStoreState {
  /** Server state by host key. */
  servers: Record<string, LspServerState | undefined>;
  /** Diagnostic counts by host key → server-form URI (drives the footer). */
  diagnostics: Record<string, Record<string, LspDiagnosticCounts> | undefined>;
  /** Bumped whenever a server becomes / stops being usable — the editor recomputes per-tab
   * LSP extensions off this. */
  revision: number;

  /** Make sure the server covering this tab's language is up; connect a client when it is. */
  ensureForTab: (tab: EnsureTabArgs) => void;
  applyDiagnostics: (key: string, uri: string, diagnostics: unknown[]) => void;
  applyServerStatus: (payload: {
    key: string;
    serverId: string;
    status: string;
    message?: string;
  }) => void;
  /** Settings toggle: persists the preference and stops/starts the host process. */
  setServerEnabled: (projectId: string, serverId: string, enabled: boolean) => void;
  /** Tell the server a tab's buffer was persisted (after a successful fs.writeFile). */
  notifyFileSaved: (tab: { projectId: string; fileName: string; absPath: string }) => void;
}

/**
 * Live `LSPClient`s by host key. Deliberately outside the zustand state — clients are stateful
 * connection objects, not renderable data; the store mirrors their status via `servers`.
 */
const clients = new Map<string, LSPClient>();

export function lspClientFor(key: string): LSPClient | null {
  return clients.get(key) ?? null;
}

function lspKeyForFile(
  projectId: string,
  fileName: string,
): {
  key: string;
  serverId: string;
  languageId: string;
} | null {
  const languageId = languageIdForFile(fileName);
  if (!languageId) return null;
  const def = serverForLanguageId(languageId);
  if (!def) return null;
  return { key: `${projectId}:${def.id}`, serverId: def.id, languageId };
}

function disposeClient(key: string): void {
  const client = clients.get(key);
  if (client) {
    clients.delete(key);
    try {
      client.disconnect();
    } catch {
      // Transport already gone.
    }
  }
  disposeLspTransport(key);
}

function severityCounts(diagnostics: unknown[]): LspDiagnosticCounts {
  let errors = 0;
  let warnings = 0;
  for (const item of diagnostics) {
    const severity = (item as { severity?: number } | null)?.severity ?? 1;
    if (severity === 1) errors++;
    else if (severity === 2) warnings++;
  }
  return { errors, warnings };
}

export const useLspStore = create<LspStoreState>((set, get) => ({
  servers: {},
  diagnostics: {},
  revision: 0,

  ensureForTab: ({ projectId, fileName }) => {
    const resolved = lspKeyForFile(projectId, fileName);
    if (!resolved) return;
    const { key, serverId, languageId } = resolved;

    if (!useLspSettingsStore.getState().isEnabled(serverId)) {
      const current = get().servers[key];
      if (current?.status !== "disabled") {
        set((s) => ({
          servers: { ...s.servers, [key]: { key, serverId, status: "disabled" } },
        }));
      }
      return;
    }

    const existing = get().servers[key];
    if (existing) {
      if (existing.status === "crashed") {
        const age = Date.now() - (existing.crashedAt ?? 0);
        if (age < CRASH_RETRY_COOLDOWN_MS) return;
      } else if (existing.status !== "disabled") {
        return; // starting / ready / missing — nothing to do
      }
    }

    const client = useSessionsStore.getState().client;
    if (!client) return;

    // Mark starting synchronously so concurrent tab swaps don't double-ensure.
    set((s) => ({
      servers: { ...s.servers, [key]: { key, serverId, status: "starting" } },
      revision: s.revision + 1,
    }));

    void (async () => {
      try {
        const res = await client.call("lsp.ensure", { projectId, languageId });
        if (res.status === "missing") {
          set((s) => ({
            servers: {
              ...s.servers,
              [key]: { key, serverId, status: "missing", installHint: res.installHint },
            },
            revision: s.revision + 1,
          }));
          return;
        }
        if (res.status === "unsupported") {
          set((s) => {
            const { [key]: _gone, ...servers } = s.servers;
            return { servers, revision: s.revision + 1 };
          });
          return;
        }
        let lspClient = clients.get(key);
        if (!lspClient) {
          const deckRoot = uriToDeckPath(res.rootUri, res.mapping);
          if (!deckRoot) throw new Error(`Unmappable LSP root: ${res.rootUri}`);
          const transport = createLspTransport(client, key);
          lspClient = new LSPClient({
            rootUri: res.rootUri,
            timeout: REQUEST_TIMEOUT_MS,
            extensions: languageServerExtensions(),
            workspace: (c) => new PidLspWorkspace(c, { projectId, mapping: res.mapping, deckRoot }),
          });
          clients.set(key, lspClient);
          lspClient.connect(transport);
        }
        await lspClient.initializing;
        set((s) => ({
          servers: {
            ...s.servers,
            [key]: { key, serverId, status: "ready", mapping: res.mapping, rootUri: res.rootUri },
          },
          revision: s.revision + 1,
        }));
      } catch (err) {
        disposeClient(key);
        set((s) => ({
          servers: {
            ...s.servers,
            [key]: {
              key,
              serverId,
              status: "crashed",
              crashedAt: Date.now(),
              message: err instanceof Error ? err.message : String(err),
            },
          },
          revision: s.revision + 1,
        }));
      }
    })();
  },

  applyDiagnostics: (key, uri, diagnostics) => {
    set((s) => ({
      diagnostics: {
        ...s.diagnostics,
        [key]: { ...s.diagnostics[key], [uri]: severityCounts(diagnostics) },
      },
    }));
  },

  applyServerStatus: ({ key, serverId, status, message }) => {
    if (status === "running") return; // the ensure() response is authoritative for startup
    disposeClient(key);
    if (status === "crashed") {
      // One non-blocking notice per crash; the editor quietly falls back to built-in completion.
      useNotificationStore.getState().error(`${serverId} language server crashed`, {
        id: `lsp-crash-${key}`,
        body: message ?? "The editor fell back to basic completion. Reopen a file to retry.",
      });
      set((s) => ({
        servers: {
          ...s.servers,
          [key]: { key, serverId, status: "crashed", crashedAt: Date.now(), message },
        },
        diagnostics: { ...s.diagnostics, [key]: {} },
        revision: s.revision + 1,
      }));
      return;
    }
    // Clean exit (idle GC, manual shutdown): forget the server so the next tab re-ensures.
    set((s) => {
      const { [key]: _gone, ...servers } = s.servers;
      return {
        servers,
        diagnostics: { ...s.diagnostics, [key]: {} },
        revision: s.revision + 1,
      };
    });
  },

  setServerEnabled: (projectId, serverId, enabled) => {
    useLspSettingsStore.getState().setEnabled(serverId, enabled);
    const key = `${projectId}:${serverId}`;
    if (enabled) {
      set((s) => {
        const current = s.servers[key];
        if (current?.status !== "disabled") return s;
        const { [key]: _gone, ...servers } = s.servers;
        return { servers, revision: s.revision + 1 };
      });
      return;
    }
    const client = useSessionsStore.getState().client;
    if (client && clients.has(key)) {
      void client.call("lsp.shutdown", { key }).catch(() => {});
    }
    disposeClient(key);
    set((s) => ({
      servers: { ...s.servers, [key]: { key, serverId, status: "disabled" } },
      diagnostics: { ...s.diagnostics, [key]: {} },
      revision: s.revision + 1,
    }));
  },

  notifyFileSaved: ({ projectId, fileName, absPath }) => {
    const resolved = lspKeyForFile(projectId, fileName);
    if (!resolved) return;
    const server = get().servers[resolved.key];
    const client = clients.get(resolved.key);
    if (!client || server?.status !== "ready" || !server.mapping) return;
    const uri = deckPathToUri(absPath, server.mapping);
    if (!uri) return;
    client.notification("textDocument/didSave", { textDocument: { uri } });
  },
}));

/** Diagnostic counts for one file (server-form URI resolution included), or null. */
export function selectTabDiagnostics(
  tab: { projectId: string; fileName: string; absPath: string } | undefined,
) {
  return (s: Pick<LspStoreState, "servers" | "diagnostics">): LspDiagnosticCounts | null => {
    if (!tab) return null;
    const resolved = lspKeyForFile(tab.projectId, tab.fileName);
    if (!resolved) return null;
    const server = s.servers[resolved.key];
    if (server?.status !== "ready" || !server.mapping) return null;
    const uri = deckPathToUri(tab.absPath, server.mapping);
    if (!uri) return null;
    return s.diagnostics[resolved.key]?.[uri] ?? null;
  };
}

/** The server state covering a tab's language, or null when LSP doesn't apply. */
export function selectTabServer(tab: { projectId: string; fileName: string } | undefined) {
  return (s: Pick<LspStoreState, "servers">): LspServerState | null => {
    if (!tab) return null;
    const resolved = lspKeyForFile(tab.projectId, tab.fileName);
    if (!resolved) return null;
    return s.servers[resolved.key] ?? null;
  };
}
