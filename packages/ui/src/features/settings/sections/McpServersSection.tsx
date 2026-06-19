import type { CommandResponse } from "@pi-deck/core/protocol/commands.js";
import { Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PidButton } from "../../../components/buttons/PidButton";
import { PidChip } from "../../../components/chip/PidChip";
import { humanizeError } from "../../../lib/format/humanize-error.js";
import { useNotificationStore } from "../../_status/useNotificationStore.js";
import { useProjectsStore } from "../../sessions/useProjectsStore";
import { useSessionsStore } from "../../sessions/useSessionsStore";
import { InstallMcpServerModal } from "./InstallMcpServerModal";

type McpData = CommandResponse<"mcp.list">;
type McpServerInfo = McpData["servers"][number];

const THIN_CTL = {
  height: 28,
  paddingTop: 0,
  paddingBottom: 0,
  boxSizing: "border-box",
} as const;

/**
 * Settings → MCP Servers. Lists pi-deck's catalog of installed MCP servers (plus any added by
 * hand to the project's `.pi/mcp.json`) and lets you toggle each one on/off for the active
 * project. The adapter has no enable flag, so "on" writes the server into `.pi/mcp.json` and
 * "off" removes it. Install new servers from the official registry via the modal.
 */
export function McpServersSection() {
  const projectId = useProjectsStore((s) => s.activeProjectId);
  const projectName = useProjectsStore(
    (s) => s.projects.find((p) => p.id === s.activeProjectId)?.displayName,
  );
  const [data, setData] = useState<McpData | null>(null);
  const [loading, setLoading] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const client = useSessionsStore.getState().client;
    if (!client || !projectId) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      setData(await client.call("mcp.list", { projectId }));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleEnabled = async (server: McpServerInfo) => {
    const client = useSessionsStore.getState().client;
    if (!client || !projectId) return;
    try {
      await client.call("mcp.setProjectEnabled", {
        projectId,
        name: server.name,
        enabled: !server.enabledInProject,
      });
      await load();
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, "Failed to update server"));
    }
  };

  const uninstall = async (server: McpServerInfo) => {
    const client = useSessionsStore.getState().client;
    if (!client || !projectId) return;
    try {
      await client.call("mcp.uninstall", { projectId, name: server.name });
      await load();
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, "Failed to remove server"));
    }
  };

  const allServers = data?.servers ?? [];
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? allServers.filter((s) =>
            `${s.name} ${s.description ?? ""} ${s.command ?? ""} ${s.url ?? ""}`
              .toLowerCase()
              .includes(q),
          )
        : allServers,
    [allServers, q],
  );

  const enabledCount = allServers.filter((s) => s.enabledInProject).length;
  const installedNames = useMemo(() => new Set(allServers.map((s) => s.name)), [allServers]);
  const adapter = data?.adapter;

  return (
    <div className="pid-settings-panel-inner">
      <header>
        <div className="pid-settings-section-kicker">Settings · MCP Servers</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 className="pid-settings-section-title">MCP Servers</h1>
          {projectId && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--ink-3)",
                letterSpacing: "0.08em",
              }}
            >
              <span style={{ color: "var(--accent)" }}>{enabledCount}</span> of {allServers.length}{" "}
              on{projectName ? ` in ${projectName}` : ""}
            </span>
          )}
        </div>
      </header>

      <section className="pid-settings-block">
        <div className="pid-settings-block-desc">
          Connect MCP servers through <code>pi-mcp-adapter</code> — one token-efficient{" "}
          <code>mcp</code> proxy tool instead of hundreds of definitions. Servers are added to your
          catalog, then toggled on per project (written to <code>.pi/mcp.json</code>).
        </div>
      </section>

      {/* Adapter status strip */}
      <section className="pid-settings-block">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: adapter?.installed ? "var(--add)" : "var(--ink-3)",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "var(--t-13)", color: "var(--ink-0)" }}>
            {adapter?.installed ? "Adapter installed" : "Adapter not detected"}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>
            npm:pi-mcp-adapter{adapter?.version ? ` · v${adapter.version}` : ""}
          </span>
          {!adapter?.installed && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>
              · install with <code>pi install npm:pi-mcp-adapter@2.10.0</code>
            </span>
          )}
        </div>
      </section>

      <section className="pid-settings-block">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 28,
              boxSizing: "border-box",
              padding: "0 10px",
              background: "var(--bg-1)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              color: "var(--ink-3)",
            }}
          >
            <Search size={13} aria-hidden />
            <input
              style={{
                flex: 1,
                alignSelf: "stretch",
                border: 0,
                outline: "none",
                background: "transparent",
                padding: 0,
                color: "var(--ink-0)",
                fontFamily: "var(--font-ui)",
                fontSize: "var(--t-13)",
              }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter servers…"
              spellCheck={false}
            />
            {query && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>
                {filtered.length}
              </span>
            )}
          </div>
          <PidButton
            variant="primary"
            longLabel
            style={THIN_CTL}
            icon={<Plus size={12} aria-hidden />}
            disabled={!projectId}
            onClick={() => setInstallOpen(true)}
          >
            Install server
          </PidButton>
        </div>

        {!projectId ? (
          <div className="pid-list-empty" style={{ marginTop: 12 }}>
            Open a project to configure its MCP servers.
          </div>
        ) : (
          <div
            style={{
              marginTop: 12,
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              background: "var(--bg-1)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                padding: "10px 14px 8px",
                borderBottom: "1px solid var(--line)",
                background: "var(--bg-2)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              <span style={{ color: "var(--ink-1)" }}>Installed</span>
              <span style={{ color: "var(--ink-3)" }}>· your catalog</span>
              <span style={{ marginLeft: "auto", color: "var(--ink-3)" }}>
                on in {projectName ?? "project"} →
              </span>
            </div>
            {filtered.length === 0 ? (
              <div className="pid-list-empty" style={{ padding: "20px 14px" }}>
                {loading
                  ? "Loading…"
                  : query
                    ? `No servers match “${query}”.`
                    : "No servers installed yet — install one from the registry."}
              </div>
            ) : (
              filtered.map((server) => (
                <McpServerRow
                  key={server.name}
                  server={server}
                  onToggle={() => void toggleEnabled(server)}
                  onUninstall={uninstall}
                />
              ))
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>
            Toggling a server writes / removes it in this project's <code>.pi/mcp.json</code>.
          </span>
        </div>
      </section>

      <InstallMcpServerModal
        open={installOpen}
        onOpenChange={setInstallOpen}
        projectId={projectId}
        projectName={projectName}
        installedNames={installedNames}
        onInstalled={() => void load()}
      />
    </div>
  );
}

function McpServerRow({
  server,
  onToggle,
  onUninstall,
}: {
  server: McpServerInfo;
  onToggle: () => void;
  onUninstall: (server: McpServerInfo) => Promise<void>;
}) {
  // Deleting off disk deserves a second click; the arm state resets after a beat.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);

  const on = server.enabledInProject;
  const target = server.transport === "http" ? server.url : server.command;
  const args = server.transport === "stdio" && server.args ? ` ${server.args.join(" ")}` : "";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 14,
        alignItems: "start",
        padding: "14px",
        borderTop: "1px solid var(--line)",
        opacity: on ? 1 : 0.66,
        transition: "opacity 120ms",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--t-13)", fontWeight: 500, color: "var(--ink-0)" }}>
            {server.name}
          </span>
          <PidChip variant="info">{server.transport}</PidChip>
          {server.lifecycle !== "lazy" && <PidChip>{server.lifecycle}</PidChip>}
          {server.auth && <PidChip variant="mod">{server.auth}</PidChip>}
          {server.source === "project" && <PidChip>project file</PidChip>}
        </div>
        {server.description && (
          <div style={{ color: "var(--ink-2)", fontSize: "var(--t-12)", marginTop: 3 }}>
            {server.description}
          </div>
        )}
        {target && (
          <div
            style={{
              color: "var(--ink-3)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.04em",
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={`${target}${args}`}
          >
            {target}
            {args}
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <PidButton
            variant={armed ? "danger" : "ghost"}
            longLabel
            style={THIN_CTL}
            onClick={() => {
              if (!armed) {
                setArmed(true);
                return;
              }
              setArmed(false);
              void onUninstall(server);
            }}
          >
            {armed ? "Confirm remove" : "Remove"}
          </PidButton>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 4,
          paddingTop: 2,
        }}
      >
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={on ? `Disable ${server.name}` : `Enable ${server.name}`}
          className="pid-toggle-switch"
          data-on={on || undefined}
          onClick={onToggle}
        >
          <span className="pid-toggle-switch-thumb" />
        </button>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: on ? "var(--accent)" : "var(--ink-3)",
          }}
        >
          {on ? "on by default" : "off"}
        </span>
      </div>
    </div>
  );
}
