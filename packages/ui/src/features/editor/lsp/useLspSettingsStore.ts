import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Per-language-server enable switches, surfaced in Settings → Editor. Servers are on by
 * default — the list stores opt-outs so newly added server definitions light up without a
 * settings migration.
 */
interface LspSettingsState {
  disabledServers: string[];
  setEnabled: (serverId: string, enabled: boolean) => void;
  isEnabled: (serverId: string) => boolean;
}

export const useLspSettingsStore = create<LspSettingsState>()(
  persist(
    (set, get) => ({
      disabledServers: [],
      setEnabled: (serverId, enabled) =>
        set((s) => ({
          disabledServers: enabled
            ? s.disabledServers.filter((id) => id !== serverId)
            : s.disabledServers.includes(serverId)
              ? s.disabledServers
              : [...s.disabledServers, serverId],
        })),
      isEnabled: (serverId) => !get().disabledServers.includes(serverId),
    }),
    { name: "pi-deck:lsp-settings:v1", version: 1 },
  ),
);
