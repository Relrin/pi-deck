import type { CommandResponse } from "@pi-deck/core/protocol/commands.js";
import {
  ChevronDown,
  Folder,
  FolderOpen,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PidButton } from "../../../components/buttons/PidButton";
import { useI18nContext } from "../../../i18n/i18n-react.js";
import type { TranslationFunctions } from "../../../i18n/i18n-types.js";
import { rich, slot } from "../../../i18n/rich.js";
import { humanizeError } from "../../../lib/format/humanize-error.js";
import { useNotificationStore } from "../../_status/useNotificationStore.js";
import { useProjectsStore } from "../../sessions/useProjectsStore";
import { useSessionsStore } from "../../sessions/useSessionsStore";
import { InstallMcpServerModal } from "./InstallMcpServerModal";

type McpData = CommandResponse<"mcp.list">;
type McpServerInfo = McpData["servers"][number];
type Lifecycle = NonNullable<McpServerInfo["lifecycle"]>;
type Expose = "proxy" | "direct";
type ConfigChange = { lifecycle?: Lifecycle; expose?: Expose; idleTimeout?: number };

const THIN_CTL = {
  height: 28,
  paddingTop: 0,
  paddingBottom: 0,
  boxSizing: "border-box",
  lineHeight: 1,
} as const;

/**
 * Built per render rather than held as module constants: a module-level table would capture
 * whatever locale was loaded at import time. `value` is the protocol value in both cases.
 */
export function lifecycleOptions(
  t: TranslationFunctions,
): { value: Lifecycle; label: string; hint: string }[] {
  const copy = t.settings.mcp.config;
  return [
    { value: "lazy", label: copy.lazy.label(), hint: copy.lazy.hint() },
    { value: "eager", label: copy.eager.label(), hint: copy.eager.hint() },
    { value: "keep-alive", label: copy.keepAlive.label(), hint: copy.keepAlive.hint() },
  ];
}

export function idleOptions(t: TranslationFunctions): { value: number; label: string }[] {
  const copy = t.settings.mcp.config;
  return [
    { value: 5, label: copy.idle5() },
    { value: 10, label: copy.idle10() },
    { value: 30, label: copy.idle30() },
    { value: 0, label: copy.idleNever() },
  ];
}

/**
 * Settings → MCP Servers. Lists pi-deck's catalog of installed MCP servers (plus any added by
 * hand to the project's `.pi/mcp.json`) and lets you toggle each on/off for the active project.
 * The adapter has no enable flag, so "on" writes the server into `.pi/mcp.json` and "off"
 * removes it. The per-server Configure panel edits lifecycle, tool exposure and idle timeout;
 * tool counts come from the adapter's metadata cache. Install from the registry via the modal.
 */
export function McpServersSection() {
  const { LL } = useI18nContext();
  const projects = useProjectsStore((s) => s.projects);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const [selectedId, setSelectedId] = useState<string | undefined>(activeProjectId);
  const [data, setData] = useState<McpData | null>(null);
  const [loading, setLoading] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Default the picker to the active project once it loads.
  useEffect(() => {
    if (!selectedId && activeProjectId) setSelectedId(activeProjectId);
  }, [activeProjectId, selectedId]);

  const projectId = selectedId;
  const selectedProject = projects.find((p) => p.id === projectId);
  const projectName = selectedProject?.displayName;
  const projectPath = selectedProject?.path;
  const configPath = data?.configPath;

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

  const openLocation = async () => {
    const bridge = window.bridge;
    if (!bridge?.openPath) return;
    // Reveal the `.pi` dir; fall back to the project root when it doesn't exist yet.
    const dir = configPath?.replace(/[\\/]mcp\.json$/i, "");
    if (dir) {
      const err = await bridge.openPath(dir);
      if (err && projectPath) await bridge.openPath(projectPath);
    } else if (projectPath) {
      await bridge.openPath(projectPath);
    }
  };

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
      useNotificationStore.getState().error(humanizeError(err, LL.settings.errors.updateServer()));
    }
  };

  const setConfig = async (name: string, changes: ConfigChange) => {
    const client = useSessionsStore.getState().client;
    if (!client || !projectId) return;
    try {
      await client.call("mcp.setConfig", { projectId, name, ...changes });
      await load();
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, LL.settings.errors.updateConfig()));
    }
  };

  const setToken = async (name: string, token: string | null) => {
    const client = useSessionsStore.getState().client;
    if (!client || !projectId) return;
    try {
      await client.call("mcp.setToken", { projectId, name, token });
      useNotificationStore
        .getState()
        .success(token ? LL.settings.mcp.token.saved() : LL.settings.mcp.token.cleared(), {
          body: token ? LL.settings.mcp.token.savedBody() : undefined,
        });
      await load();
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, LL.settings.errors.saveToken()));
    }
  };

  const reconnect = async (name: string) => {
    const client = useSessionsStore.getState().client;
    if (!client) return;
    try {
      await client.call("mcp.reconnect", { name });
      useNotificationStore.getState().success(LL.settings.mcp.reconnectQueued(), {
        body: LL.settings.mcp.reconnectBody({ name }),
      });
      await load();
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, LL.settings.errors.reconnect()));
    }
  };

  const uninstall = async (server: McpServerInfo) => {
    const client = useSessionsStore.getState().client;
    if (!client || !projectId) return;
    try {
      await client.call("mcp.uninstall", { projectId, name: server.name });
      setExpanded((e) => (e === server.name ? null : e));
      await load();
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, LL.settings.errors.removeServer()));
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
        <div className="pid-settings-section-kicker">
          {LL.settings.kicker({ section: LL.settings.mcp.kicker() })}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 className="pid-settings-section-title">{LL.settings.mcp.title()}</h1>
          {projectId && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--ink-3)",
                letterSpacing: "0.08em",
              }}
            >
              {rich(
                projectName
                  ? LL.settings.mcp.countOnInProject({
                      enabled: slot("enabled"),
                      total: allServers.length,
                      project: projectName,
                    })
                  : LL.settings.mcp.countOn({
                      enabled: slot("enabled"),
                      total: allServers.length,
                    }),
                {
                  enabled: <span style={{ color: "var(--accent)" }}>{enabledCount}</span>,
                },
              )}
            </span>
          )}
        </div>
      </header>

      <section className="pid-settings-block">
        <div className="pid-settings-block-desc">
          {/* The package name, the proxy tool name and the config path are all identifiers. */}
          {rich(
            LL.settings.mcp.about({
              adapter: slot("adapter"),
              proxy: slot("proxy"),
              config: slot("config"),
            }),
            {
              adapter: <code>pi-mcp-adapter</code>, // i18n-exempt: the npm package name
              proxy: <code>mcp</code>, // i18n-exempt: pi's own tool name
              config: <code>.pi/mcp.json</code>,
            },
          )}
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
            {adapter?.installed
              ? LL.settings.mcp.adapter.installed()
              : LL.settings.mcp.adapter.notDetected()}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>
            npm:pi-mcp-adapter{adapter?.version ? ` · v${adapter.version}` : ""}
          </span>
          {!adapter?.installed && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>
              {rich(LL.settings.mcp.adapter.installWith({ cmd: slot("cmd") }), {
                // i18n-exempt: the literal command the user would type
                cmd: <code>pi install npm:pi-mcp-adapter@2.10.0</code>,
              })}
            </span>
          )}
        </div>
      </section>

      <section className="pid-settings-block">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ProjectPicker projects={projects} value={projectId} onChange={setSelectedId} />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              lineHeight: 1,
              color: "var(--ink-3)",
            }}
          >
            {rich(LL.settings.mcp.writesTo({ path: slot("path") }), {
              path: <span style={{ color: "var(--ink-2)" }}>.pi/mcp.json</span>,
            })}
          </span>
          <PidButton
            variant="ghost"
            style={THIN_CTL}
            icon={<FolderOpen size={12} aria-hidden />}
            disabled={!projectPath}
            title={LL.settings.mcp.revealTitle()}
            aria-label={LL.settings.mcp.revealAria()}
            onClick={() => void openLocation()}
          />
          <span style={{ flex: 1 }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: 200,
              height: 28,
              boxSizing: "border-box",
              padding: "0 10px",
              background: "var(--bg-1)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              color: "var(--ink-3)",
            }}
          >
            <Search size={13} aria-hidden style={{ flexShrink: 0 }} />
            <input
              style={{
                flex: 1,
                minWidth: 0,
                border: 0,
                outline: "none",
                background: "transparent",
                padding: 0,
                margin: 0,
                color: "var(--ink-0)",
                fontFamily: "var(--font-ui)",
                fontSize: "var(--t-13)",
                lineHeight: 1,
              }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={LL.settings.mcp.filterPlaceholder()}
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
            {LL.settings.mcp.installServer()}
          </PidButton>
        </div>

        {!projectId ? (
          <div className="pid-list-empty" style={{ marginTop: 12 }}>
            {LL.settings.mcp.noProject()}
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
              <span style={{ color: "var(--ink-1)" }}>{LL.settings.mcp.list.installed()}</span>
              <span style={{ color: "var(--ink-3)" }}>{LL.settings.mcp.list.catalogHint()}</span>
              <span style={{ marginLeft: "auto", color: "var(--ink-3)" }}>
                {LL.settings.mcp.list.onIn({
                  project: projectName ?? LL.settings.mcp.list.projectFallback(),
                })}
              </span>
            </div>
            {filtered.length === 0 ? (
              <div className="pid-list-empty" style={{ padding: "20px 14px" }}>
                {loading
                  ? LL.settings.mcp.loading()
                  : query
                    ? LL.settings.mcp.noMatch({ query })
                    : LL.settings.mcp.empty()}
              </div>
            ) : (
              filtered.map((server) => (
                <McpServerRow
                  key={server.name}
                  server={server}
                  expanded={expanded === server.name}
                  onToggleExpand={() =>
                    setExpanded((e) => (e === server.name ? null : server.name))
                  }
                  onToggleEnabled={() => void toggleEnabled(server)}
                  onConfigChange={(changes) => void setConfig(server.name, changes)}
                  onReconnect={() => void reconnect(server.name)}
                  onSetToken={(token) => void setToken(server.name, token)}
                  onUninstall={() => void uninstall(server)}
                />
              ))
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>
            {rich(LL.settings.mcp.toggleHint({ path: slot("path") }), {
              path: <code>.pi/mcp.json</code>,
            })}
          </span>
        </div>
      </section>

      <InstallMcpServerModal
        open={installOpen}
        onOpenChange={setInstallOpen}
        projectId={projectId}
        projectName={projectName}
        configPath={configPath}
        installedNames={installedNames}
        onInstalled={() => void load()}
      />
    </div>
  );
}

/** Small squared chip (radius 3) reflecting a server setting. Accent tone highlights "direct". */
function Chip({ children, tone }: { children: React.ReactNode; tone?: "accent" }) {
  const accent = tone === "accent";
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "1px 5px",
        borderRadius: 3,
        color: accent ? "var(--accent)" : "var(--ink-3)",
        background: accent ? "var(--accent-soft)" : "var(--bg-2)",
        border: `1px solid ${accent ? "var(--accent-line)" : "var(--line)"}`,
      }}
    >
      {children}
    </span>
  );
}

function ProjectPicker({
  projects,
  value,
  onChange,
}: {
  projects: { id: string; displayName: string }[];
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  const { LL } = useI18nContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const current = projects.find((p) => p.id === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <PidButton
        longLabel
        style={THIN_CTL}
        icon={<Folder size={12} aria-hidden />}
        disabled={projects.length === 0}
        onClick={() => setOpen((o) => !o)}
      >
        {current?.displayName ?? LL.settings.mcp.projectPicker.select()}
        <ChevronDown size={9} aria-hidden style={{ marginLeft: 4 }} />
      </PidButton>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 4,
            zIndex: 30,
            minWidth: 200,
            maxHeight: 280,
            overflowY: "auto",
            background: "var(--bg-1)",
            border: "1px solid var(--line-strong)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-pop, 0 8px 24px rgba(0,0,0,0.4))",
          }}
        >
          <div
            style={{
              padding: "8px 12px 4px",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
            }}
          >
            {LL.settings.mcp.projectPicker.header()}
          </div>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange(p.id);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                border: 0,
                cursor: "pointer",
                background: p.id === value ? "var(--accent-soft)" : "transparent",
                color: p.id === value ? "var(--accent)" : "var(--ink-1)",
                fontFamily: "var(--font-ui)",
                fontSize: 13,
              }}
            >
              <Folder size={12} aria-hidden />
              {p.displayName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 3,
        padding: 3,
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            title={o.hint}
            onClick={() => onChange(o.value)}
            style={{
              border: "none",
              cursor: "pointer",
              borderRadius: 3,
              padding: "4px 11px",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.02em",
              background: on ? "var(--accent-soft)" : "transparent",
              color: on ? "var(--accent)" : "var(--ink-2)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ConfigRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 16,
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ fontSize: "var(--t-13)", color: "var(--ink-0)" }}>{label}</div>
        <div style={{ fontSize: "var(--t-12)", color: "var(--ink-3)", marginTop: 2 }}>{hint}</div>
      </div>
      {children}
    </div>
  );
}

/** Mirror of the host's toAdapterEntry, for the read-only `.pi/mcp.json` preview. */
function buildPreview(server: McpServerInfo): string {
  const lifecycle: Lifecycle = server.lifecycle ?? "lazy";
  const expose: Expose = (server.expose as Expose) ?? "proxy";
  const entry: Record<string, unknown> = {};
  if (server.transport === "http") {
    if (server.url) entry.url = server.url;
    if (server.headers) entry.headers = server.headers;
  } else {
    if (server.command) entry.command = server.command;
    if (server.args) entry.args = server.args;
  }
  if (server.env) entry.env = server.env;
  if (server.auth) entry.auth = server.auth;
  entry.lifecycle = lifecycle;
  if (lifecycle === "lazy" && server.idleTimeout !== undefined)
    entry.idleTimeout = server.idleTimeout;
  if (expose === "direct") entry.directTools = true;
  const body = JSON.stringify({ [server.name]: entry }, null, 2);
  // Drop the outermost braces so it reads like a fragment of the file.
  return body.replace(/^\{\n/, "").replace(/\n\}$/, "").replace(/^ {2}/gm, "");
}

function ServerConfigPanel({
  server,
  onConfigChange,
  onReconnect,
  onSetToken,
  onUninstall,
}: {
  server: McpServerInfo;
  onConfigChange: (changes: ConfigChange) => void;
  onReconnect: () => void;
  onSetToken: (token: string | null) => void;
  onUninstall: () => void;
}) {
  const { LL, locale } = useI18nContext();
  const [armed, setArmed] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [tokenValue, setTokenValue] = useState("");
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);

  const saveToken = () => {
    const t = tokenValue.trim();
    if (!t) return;
    onSetToken(t);
    setTokenValue("");
    setTokenOpen(false);
  };
  const clearToken = () => {
    onSetToken(null);
    setTokenValue("");
    setTokenOpen(false);
  };

  const lifecycle: Lifecycle = server.lifecycle ?? "lazy";
  const expose: Expose = (server.expose as Expose) ?? "proxy";
  const idle = server.idleTimeout ?? 10;
  // Explicit locale: a bare `toLocaleString()` follows the *host* locale, so this figure could be
  // grouped differently from every other number in the app. The surrounding copy is phase 05.
  const tokenCount =
    server.estimatedTokens != null ? server.estimatedTokens.toLocaleString(locale) : null;

  const cfg = LL.settings.mcp.config;
  const lifecycles = lifecycleOptions(LL);
  const exposureHint =
    expose === "direct"
      ? server.toolCount != null
        ? tokenCount != null
          ? cfg.exposeDirectCountTokens({ count: server.toolCount, tokens: tokenCount })
          : cfg.exposeDirectCount({ count: server.toolCount })
        : cfg.exposeDirect()
      : cfg.exposeProxy();

  return (
    <div
      style={{
        marginTop: 12,
        borderTop: "1px solid var(--line)",
        paddingTop: 12,
        display: "grid",
        gap: 12,
      }}
    >
      <ConfigRow
        label={cfg.lifecycle()}
        hint={lifecycles.find((l) => l.value === lifecycle)?.hint ?? ""}
      >
        <Segmented
          value={lifecycle}
          options={lifecycles}
          onChange={(v) => onConfigChange({ lifecycle: v })}
        />
      </ConfigRow>

      <ConfigRow label={cfg.exposure()} hint={exposureHint}>
        <Segmented
          value={expose}
          options={[
            { value: "proxy", label: cfg.proxy() },
            { value: "direct", label: cfg.direct() },
          ]}
          onChange={(v) => onConfigChange({ expose: v })}
        />
      </ConfigRow>

      {lifecycle === "lazy" && (
        <ConfigRow label={cfg.idle()} hint={cfg.idleHint()}>
          <Segmented
            value={idle}
            options={idleOptions(LL)}
            onChange={(v) => onConfigChange({ idleTimeout: v })}
          />
        </ConfigRow>
      )}

      <div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-3)",
            marginBottom: 6,
          }}
        >
          .pi/mcp.json
        </div>
        <pre
          style={{
            margin: 0,
            padding: "10px 12px",
            background: "var(--bg-0)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--ink-2)",
            lineHeight: 1.6,
            overflowX: "auto",
            whiteSpace: "pre",
          }}
        >
          {buildPreview(server)}
        </pre>
      </div>

      {tokenOpen && (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              // biome-ignore lint/a11y/noAutofocus: opening the editor is an explicit token action
              autoFocus
              type="password"
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveToken();
                if (e.key === "Escape") setTokenOpen(false);
              }}
              placeholder={LL.settings.mcp.token.placeholder()}
              spellCheck={false}
              style={{
                flex: 1,
                minWidth: 0,
                height: 28,
                boxSizing: "border-box",
                padding: "0 10px",
                background: "var(--bg-1)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                color: "var(--ink-0)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                lineHeight: 1,
                outline: "none",
              }}
            />
            <PidButton
              variant="primary"
              longLabel
              style={THIN_CTL}
              disabled={!tokenValue.trim()}
              onClick={saveToken}
            >
              {LL.settings.mcp.token.save()}
            </PidButton>
            {server.hasToken && (
              <PidButton
                variant="ghost"
                longLabel
                style={{ ...THIN_CTL, color: "var(--del)" }}
                onClick={clearToken}
              >
                {LL.settings.mcp.token.clear()}
              </PidButton>
            )}
            <PidButton
              variant="ghost"
              longLabel
              style={THIN_CTL}
              onClick={() => setTokenOpen(false)}
            >
              {LL.common.cancel()}
            </PidButton>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>
            {LL.settings.mcp.token.hint()}
          </span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {server.auth === "oauth" ? (
          <PidButton
            variant="ghost"
            longLabel
            style={THIN_CTL}
            icon={<Shield size={11} aria-hidden />}
            onClick={() =>
              useNotificationStore.getState().info(LL.settings.mcp.oauth.title(), {
                body: LL.settings.mcp.oauth.body({ name: server.name }),
              })
            }
          >
            {LL.settings.mcp.oauth.rerun()}
          </PidButton>
        ) : server.transport === "http" ? (
          <PidButton
            variant="ghost"
            longLabel
            style={THIN_CTL}
            icon={<KeyRound size={11} aria-hidden />}
            onClick={() => setTokenOpen((o) => !o)}
          >
            {server.hasToken ? LL.settings.mcp.token.edit() : LL.settings.mcp.token.set()}
          </PidButton>
        ) : null}
        <PidButton
          variant="ghost"
          longLabel
          style={THIN_CTL}
          icon={<RefreshCw size={11} aria-hidden />}
          onClick={onReconnect}
        >
          {LL.settings.mcp.reconnect()}
        </PidButton>
        <span style={{ flex: 1 }} />
        <PidButton
          variant={armed ? "danger" : "ghost"}
          longLabel
          style={{ ...THIN_CTL, color: armed ? undefined : "var(--del)" }}
          icon={<X size={11} aria-hidden />}
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            setArmed(false);
            onUninstall();
          }}
        >
          {armed ? LL.settings.mcp.confirmUninstall() : LL.settings.mcp.uninstall()}
        </PidButton>
      </div>
    </div>
  );
}

function McpServerRow({
  server,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onConfigChange,
  onReconnect,
  onSetToken,
  onUninstall,
}: {
  server: McpServerInfo;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onConfigChange: (changes: ConfigChange) => void;
  onReconnect: () => void;
  onSetToken: (token: string | null) => void;
  onUninstall: () => void;
}) {
  const { LL } = useI18nContext();
  const on = server.enabledInProject;
  const lifecycle: Lifecycle = server.lifecycle ?? "lazy";
  const expose: Expose = (server.expose as Expose) ?? "proxy";
  const target = server.transport === "http" ? server.url : server.command;
  const args = server.transport === "stdio" && server.args ? ` ${server.args.join(" ")}` : "";
  const statusLabel = server.cached
    ? LL.settings.mcp.status.cached()
    : LL.settings.mcp.status.notConnected();

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
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: server.cached ? "var(--ink-2)" : "var(--ink-3)",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "var(--t-13)", fontWeight: 500, color: "var(--ink-0)" }}>
            {server.name}
          </span>
          <Chip>{lifecycle}</Chip>
          {expose === "direct" && (
            <Chip tone="accent">{LL.settings.mcp.config.direct().toLowerCase()}</Chip>
          )}
          {server.auth && <Chip>{server.auth}</Chip>}
          {server.source === "project" && <Chip>{LL.settings.mcp.chip.projectFile()}</Chip>}
        </div>
        {server.description && (
          <div style={{ color: "var(--ink-2)", fontSize: "var(--t-12)", marginTop: 4 }}>
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
              marginTop: 5,
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>
            {server.toolCount != null
              ? LL.settings.mcp.status.toolCount({ count: server.toolCount })
              : ""}
            {statusLabel}
          </span>
          <PidButton
            variant="ghost"
            icon={<Settings2 size={10} aria-hidden />}
            onClick={onToggleExpand}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              lineHeight: 1,
              letterSpacing: 0,
              textTransform: "none",
              padding: "2px 7px",
              color: expanded ? "var(--accent)" : "var(--ink-3)",
            }}
          >
            {LL.settings.mcp.configure()}
            <ChevronDown
              size={8}
              aria-hidden
              style={{
                marginLeft: 4,
                transform: expanded ? "rotate(180deg)" : "none",
                transition: "transform .15s",
              }}
            />
          </PidButton>
        </div>

        {expanded && (
          <ServerConfigPanel
            server={server}
            onConfigChange={onConfigChange}
            onReconnect={onReconnect}
            onSetToken={onSetToken}
            onUninstall={onUninstall}
          />
        )}
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
          aria-label={
            on
              ? LL.settings.mcp.disableServer({ name: server.name })
              : LL.settings.mcp.enableServer({ name: server.name })
          }
          className="pid-toggle-switch"
          data-on={on || undefined}
          onClick={onToggleEnabled}
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
          {on ? LL.settings.mcp.onByDefault() : LL.settings.mcp.off()}
        </span>
      </div>
    </div>
  );
}
