import type { CommandResponse } from "@pi-deck/core/protocol/commands.js";
import { useCallback, useEffect, useState } from "react";
import { PidButton } from "../../../components/buttons/PidButton";
import { PidTogglePill } from "../../../components/segmented/PidTogglePill";
import { useLspSettingsStore } from "../../editor/lsp/useLspSettingsStore";
import { useLspStore } from "../../editor/lsp/useLspStore";
import { useProjectsStore } from "../../sessions/useProjectsStore";
import { useSessionsStore } from "../../sessions/useSessionsStore";

type LspStatusData = CommandResponse<"lsp.status">;

/**
 * Settings → Editor. Currently, hosts the language-server panel: which servers pi-deck found
 * for the active project's environment (local PATH, or inside the WSL distro for
 * `\\wsl.localhost` projects), per-language enable switches, and install hints for the rest.
 */
export function EditorSection() {
  const projectId = useProjectsStore((s) => s.activeProjectId);
  const disabledServers = useLspSettingsStore((s) => s.disabledServers);
  const setServerEnabled = useLspStore((s) => s.setServerEnabled);

  const [data, setData] = useState<LspStatusData | null>(null);
  const [loading, setLoading] = useState(false);

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

  const envDesc =
    data?.mapping.kind === "wsl"
      ? `This project lives in WSL — servers are detected and run inside the ${data.mapping.distro} distro.`
      : "Servers are detected on this machine's PATH and start automatically when you open a matching file.";

  return (
    <div className="pid-settings-panel-inner">
      <header>
        <div className="pid-settings-section-kicker">Settings · Editor</div>
        <h1 className="pid-settings-section-title">Editor</h1>
      </header>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">Language servers</div>
        <div className="pid-settings-block-desc">
          {projectId
            ? `${envDesc} Nothing is bundled — missing servers just fall back to basic completion.`
            : "Open a project to see which language servers are available for it."}
        </div>

        {data ? (
          <div className="pid-settings-lsp-list">
            {data.servers.map((server) => {
              const enabled = !disabledServers.includes(server.serverId);
              const state = server.running ? "running" : server.available ? "detected" : "missing";
              return (
                <div className="pid-settings-lsp-row" key={server.serverId}>
                  <div>
                    <div className="pid-settings-lsp-name">
                      {server.label}
                      <span className="pid-settings-lsp-state" data-state={state}>
                        {state === "missing" ? "not found" : state}
                      </span>
                    </div>
                    <div className="pid-settings-lsp-meta">
                      {server.available ? (
                        <code>{server.command}</code>
                      ) : (
                        <>
                          install: <code>{server.installHint}</code>
                        </>
                      )}
                    </div>
                  </div>
                  <PidTogglePill
                    label={enabled ? "On" : "Off"}
                    checked={enabled}
                    ariaLabel={`Enable ${server.label} language server`}
                    description="Off stops the server and falls back to basic completion."
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
          <div>
            <PidButton onClick={() => void load(true)} disabled={loading}>
              {loading ? "Detecting..." : "Re-detect servers"}
            </PidButton>
          </div>
        ) : null}
      </section>
    </div>
  );
}
