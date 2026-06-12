import type { CustomLanguageServerDef } from "@pi-deck/core/lsp/server-defs.js";
import type { CustomLspServer } from "@pi-deck/core/protocol/lsp.js";
import { create } from "zustand";
import type { ProtocolClient } from "../../../lib/transport/protocol-client.js";
import { useLspStore } from "./useLspStore.js";

/**
 * Renderer mirror of the host's user-defined language servers (`lsp.customServers.*`).
 * The host owns persistence and the spawn side; this store exists so the editor can resolve
 * "does LSP apply to this file?" synchronously (file extension → languageId → serverId) for
 * custom languages, exactly like the static built-in registry.
 */
interface LspCustomServersState {
  servers: CustomLspServer[];
  /** `servers` in the core lookup vocabulary — fed into languageIdForFile and friends. */
  defs: CustomLanguageServerDef[];
  loaded: boolean;

  refresh: (client: ProtocolClient) => Promise<void>;
  upsert: (client: ProtocolClient, server: CustomLspServer) => Promise<void>;
  remove: (client: ProtocolClient, id: string) => Promise<void>;
}

function toDefs(servers: CustomLspServer[]): CustomLanguageServerDef[] {
  return servers.map((s) => ({
    id: s.id,
    label: s.label,
    languageIds: [...s.languageIds],
    extensions: [...s.extensions],
    command: s.command,
    args: [...s.args],
    installHint: s.installHint ?? "",
  }));
}

export const useLspCustomServersStore = create<LspCustomServersState>((set) => ({
  servers: [],
  defs: [],
  loaded: false,

  refresh: async (client) => {
    const { servers } = await client.call("lsp.customServers.list", {});
    applyServers(set, servers);
  },

  upsert: async (client, server) => {
    const { servers } = await client.call("lsp.customServers.upsert", { server });
    applyServers(set, servers);
  },

  remove: async (client, id) => {
    const { servers } = await client.call("lsp.customServers.delete", { id });
    applyServers(set, servers);
  },
}));

function applyServers(
  set: (partial: Partial<LspCustomServersState>) => void,
  servers: CustomLspServer[],
): void {
  set({ servers, defs: toDefs(servers), loaded: true });
  // Editor tabs recompute their LSP compartment off this counter; a registry change can flip
  // a previously-unsupported tab to "ensure a server" (or orphan one that was removed).
  useLspStore.setState((s) => ({ revision: s.revision + 1 }));
}

/** Synchronous accessor for the lookup helpers (selectors, CodeMirror extension rebuilds). */
export function currentCustomLspDefs(): CustomLanguageServerDef[] {
  return useLspCustomServersStore.getState().defs;
}
