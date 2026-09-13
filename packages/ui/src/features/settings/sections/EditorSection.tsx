import type { CommandResponse } from "@pi-deck/core/protocol/commands.js";
import type { CustomLspServer } from "@pi-deck/core/protocol/lsp.js";
import { useCallback, useEffect, useState } from "react";
import { PidButton } from "../../../components/buttons/PidButton";
import { Plus } from "../../../components/icons/index.js";
import { PidTogglePill } from "../../../components/segmented/PidTogglePill";
import { useI18nContext } from "../../../i18n/i18n-react";
import { rich, slot } from "../../../i18n/rich";
import { AddCustomLspServerDialog } from "../../editor/lsp/AddCustomLspServerDialog";
import { useLspCustomServersStore } from "../../editor/lsp/useLspCustomServersStore";
import { useLspSettingsStore } from "../../editor/lsp/useLspSettingsStore";
import { useLspStore } from "../../editor/lsp/useLspStore";
import { useProjectsStore } from "../../sessions/useProjectsStore";
import { useSessionsStore } from "../../sessions/useSessionsStore";

type LspStatusData = CommandResponse<"lsp.status">;

/**
 * Settings → Editor. Currently, hosts the language-server panel: which servers pi-deck found
 * for the active project's environment (local PATH, or inside the WSL distro for
 * `\\wsl.localhost` projects), per-language enable switches, and install hints for the rest.
 * User-defined servers live in the same list (flagged "custom") with edit / remove actions.
 */
export function EditorSection() {
  const { LL } = useI18nContext();
  const projectId = useProjectsStore((s) => s.activeProjectId);
  const disabledServers = useLspSettingsStore((s) => s.disabledServers);
  const setServerEnabled = useLspStore((s) => s.setServerEnabled);
  const customServers = useLspCustomServersStore((s) => s.servers);
  const removeCustom = useLspCustomServersStore((s) => s.remove);

  const [data, setData] = useState<LspStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomLspServer | undefined>(undefined);

  const load = useCallback(
    async (refresh: boolean) => {
      const client = useSessionsStore.getState().client;
      if (!client || !projectId) {
        setData(null);
        return;
      }
      setLoading(true);
      try {
        setData(await client.call("lsp.status", { projectId, refresh: refresh || undefined }));
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const onRemoveCustom = async (id: string) => {
    const client = useSessionsStore.getState().client;
    if (!client) return;
    await removeCustom(client, id);
    void load(false);
  };

  // Two whole sentences rather than a shared tail glued onto the environment clause: gluing
  // byte-preserves the English and freezes its clause order, which the trailing sentence may not
  // want in another language.
  const envDesc =
    data?.mapping.kind === "wsl"
      ? LL.settings.editor.lsp.descWsl({ distro: data.mapping.distro })
      : LL.settings.editor.lsp.descLocal();

  return (
    <div className="pid-settings-panel-inner">
      <header>
        <div className="pid-settings-section-kicker">
          {LL.settings.kicker({ section: LL.settings.editor.kicker() })}
        </div>
        <h1 className="pid-settings-section-title">{LL.settings.editor.title()}</h1>
      </header>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">{LL.settings.editor.lsp.label()}</div>
        <div className="pid-settings-block-desc">
          {projectId ? envDesc : LL.settings.editor.lsp.descNoProject()}
        </div>

        {data ? (
          <div className="pid-settings-lsp-list">
            {data.servers.map((server) => {
              const enabled = !disabledServers.includes(server.serverId);
              const state = server.running ? "running" : server.available ? "detected" : "missing";
              const custom = server.custom
                ? customServers.find((c) => c.id === server.serverId)
                : undefined;
              return (
                <div className="pid-settings-lsp-row" key={server.serverId}>
                  <div>
                    <div className="pid-settings-lsp-name">
                      {server.label}
                      {/* `state` stays the raw identifier for `data-state` — the stylesheet keys
                          off it; only the badge text is copy. */}
                      <span className="pid-settings-lsp-state" data-state={state}>
                        {state === "missing"
                          ? LL.settings.editor.lsp.state.notFound()
                          : LL.settings.editor.lsp.state[state]()}
                      </span>
                      {server.custom ? (
                        <span className="pid-settings-lsp-state" data-state="custom">
                          {LL.settings.editor.lsp.state.custom()}
                        </span>
                      ) : null}
                    </div>
                    <div className="pid-settings-lsp-meta">
                      {server.available ? (
                        <code>{server.command}</code>
                      ) : server.installHint ? (
                        rich(LL.settings.editor.lsp.install({ hint: slot("hint") }), {
                          hint: <code>{server.installHint}</code>,
                        })
                      ) : (
                        <code>{server.command}</code>
                      )}
                    </div>
                  </div>
                  {custom ? (
                    <>
                      <PidButton
                        variant="ghost"
                        longLabel
                        onClick={() => {
                          setEditing(custom);
                          setDialogOpen(true);
                        }}
                      >
                        {LL.settings.editor.lsp.edit()}
                      </PidButton>
                      <PidButton
                        variant="danger"
                        longLabel
                        onClick={() => void onRemoveCustom(custom.id)}
                      >
                        {LL.common.remove()}
                      </PidButton>
                    </>
                  ) : null}
                  <PidTogglePill
                    label={enabled ? LL.settings.editor.lsp.on() : LL.settings.editor.lsp.off()}
                    checked={enabled}
                    ariaLabel={LL.settings.editor.lsp.enableServer({ label: server.label })}
                    description={LL.settings.editor.lsp.toggleDesc()}
                    onChange={(checked) => {
                      if (projectId) setServerEnabled(projectId, server.serverId, checked);
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : null}

        {projectId ? (
          <div style={{ display: "flex", gap: 8 }}>
            <PidButton onClick={() => void load(true)} disabled={loading}>
              {loading ? LL.settings.editor.lsp.detecting() : LL.settings.editor.lsp.redetect()}
            </PidButton>
            <PidButton
              icon={<Plus size={14} />}
              longLabel
              onClick={() => {
                setEditing(undefined);
                setDialogOpen(true);
              }}
            >
              {LL.settings.editor.lsp.addServer()}
            </PidButton>
          </div>
        ) : null}
      </section>

      <AddCustomLspServerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => void load(false)}
      />
    </div>
  );
}
