import type { CommandResponse } from "@pi-deck/core/protocol/commands.js";
import * as RadixDialog from "@radix-ui/react-dialog";
import { Check, Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PidButton } from "../../../components/buttons/PidButton";
import { PidChip } from "../../../components/chip/PidChip";
import { humanizeError } from "../../../lib/format/humanize-error.js";
import { useNotificationStore } from "../../_status/useNotificationStore.js";
import { useSessionsStore } from "../../sessions/useSessionsStore";

type RegistryServer = CommandResponse<"mcp.registrySearch">["servers"][number];

type Phase = "idle" | "searching" | "loaded" | "error";
type InstallState = "installing" | "done";

const THIN_CTL = {
  height: 28,
  paddingTop: 0,
  paddingBottom: 0,
  boxSizing: "border-box",
} as const;

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  projectId: string | undefined;
  projectName: string | undefined;
  /** Catalog server names already installed — rendered as "Installed". */
  installedNames: Set<string>;
  /** Called after a successful install so the parent refreshes its server list. */
  onInstalled: () => void;
}

/**
 * Settings → MCP Servers → Install server. Searches the official registry
 * (registry.modelcontextprotocol.io) by name and installs a chosen server: the host adds it
 * to pi-deck's catalog and enables it in the active project's `.pi/mcp.json`. The registry API
 * only supports name-substring search, so there are no category chips here.
 */
export function InstallMcpServerModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  installedNames,
  onInstalled,
}: Props) {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<RegistryServer[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [installing, setInstalling] = useState<Record<string, InstallState>>({});

  const runSearch = useCallback(async (q: string, cursor?: string) => {
    const client = useSessionsStore.getState().client;
    if (!client) {
      setPhase("error");
      return;
    }
    setPhase("searching");
    try {
      const res = await client.call("mcp.registrySearch", {
        query: q.trim() || undefined,
        cursor,
      });
      setResults((prev) => {
        if (!cursor) return res.servers;
        // Guard against the same server arriving on a later page.
        const seen = new Set(prev.map((s) => s.id));
        return [...prev, ...res.servers.filter((s) => !seen.has(s.id))];
      });
      setNextCursor(res.nextCursor);
      setPhase("loaded");
    } catch (err) {
      setPhase("error");
      useNotificationStore.getState().error(humanizeError(err, "Registry search failed"));
    }
  }, []);

  // Reset and prime the list each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setNextCursor(undefined);
    setInstalling({});
  }, [open]);

  // Debounced search on query change (and the initial empty-query load on open).
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => void runSearch(query), query ? 300 : 0);
    return () => clearTimeout(handle);
  }, [open, query, runSearch]);

  const handleInstall = async (s: RegistryServer) => {
    const client = useSessionsStore.getState().client;
    if (!client || !projectId) return;
    setInstalling((prev) => ({ ...prev, [s.id]: "installing" }));
    try {
      await client.call("mcp.install", { projectId, spec: s.spec });
      setInstalling((prev) => ({ ...prev, [s.id]: "done" }));
      useNotificationStore.getState().push({
        kind: "success",
        tag: "MCP",
        title: `Installed ${s.name}`,
        body: `Enabled in ${projectName ?? "this project"} · added to your MCP catalog`,
        meta: `${s.packageId || s.transport} · ${s.transport}`,
        durationMs: 6000,
      });
      onInstalled();
    } catch (err) {
      setInstalling((prev) => {
        const next = { ...prev };
        delete next[s.id];
        return next;
      });
      useNotificationStore.getState().error(humanizeError(err, "Failed to install server"));
    }
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="pid-modal-backdrop" />
        <RadixDialog.Content
          className="pid-modal"
          style={{ width: "min(760px, 92vw)", maxHeight: "min(80vh, 660px)" }}
        >
          {/* Header */}
          <div className="pid-modal-header">
            <div>
              <div className="pid-settings-section-kicker">
                mcp registry · registry.modelcontextprotocol.io
              </div>
              <RadixDialog.Title className="pid-modal-title">Install MCP server</RadixDialog.Title>
            </div>
            <RadixDialog.Description className="pid-modal-description">
              Search the official registry and install a server into your catalog — it's enabled for
              the current project right away.
            </RadixDialog.Description>
            <PidButton
              variant="ghost"
              style={THIN_CTL}
              icon={<X size={12} aria-hidden />}
              onClick={() => onOpenChange(false)}
            >
              esc
            </PidButton>
          </div>

          {/* Search bar */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--line)",
              background: "var(--bg-0)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                background: "var(--bg-1)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                color: "var(--ink-3)",
              }}
            >
              <Search size={13} aria-hidden style={{ flexShrink: 0 }} />
              <input
                // biome-ignore lint/a11y/noAutofocus: searching is the point of the modal
                autoFocus
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
                  fontSize: 13,
                  lineHeight: 1.4,
                }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the registry — name, capability, publisher…"
                spellCheck={false}
              />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>
                {phase === "searching" ? "…" : results.length}
              </span>
            </div>
          </div>

          {/* Results */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {phase === "searching" && results.length === 0 ? (
              <div className="pid-list-empty" style={{ padding: "32px 16px" }}>
                Searching the registry…
              </div>
            ) : phase === "error" ? (
              <div className="pid-list-empty" style={{ padding: "32px 16px", color: "var(--del)" }}>
                Couldn't reach the registry. Check your connection and try again.
              </div>
            ) : results.length === 0 ? (
              <div className="pid-list-empty" style={{ padding: "32px 16px" }}>
                No servers match{" "}
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-1)" }}>
                  “{query}”
                </span>
                .
              </div>
            ) : (
              <>
                {results.map((s) => (
                  <RegistryRow
                    key={s.id}
                    server={s}
                    state={installing[s.id]}
                    installed={installedNames.has(s.spec.name)}
                    disabled={!projectId}
                    onInstall={() => void handleInstall(s)}
                  />
                ))}
                {nextCursor && (
                  <div style={{ padding: "12px 16px", textAlign: "center" }}>
                    <PidButton
                      variant="ghost"
                      longLabel
                      style={THIN_CTL}
                      disabled={phase === "searching"}
                      onClick={() => void runSearch(query, nextCursor)}
                    >
                      {phase === "searching" ? "Loading…" : "Load more"}
                    </PidButton>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "10px 16px",
              borderTop: "1px solid var(--line)",
              background: "var(--bg-0)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--ink-3)",
              letterSpacing: "0.04em",
            }}
          >
            <span>{results.length} shown</span>
            <span style={{ marginLeft: "auto", color: "var(--ink-2)" }}>
              Installs into your MCP catalog
            </span>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

function RegistryRow({
  server,
  state,
  installed,
  disabled,
  onInstall,
}: {
  server: RegistryServer;
  state: InstallState | undefined;
  installed: boolean;
  disabled: boolean;
  onInstall: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 14,
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--t-13)", fontWeight: 500, color: "var(--ink-0)" }}>
            {server.name}
          </span>
          <PidChip variant="info">{server.transport}</PidChip>
          {server.publisher && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>
              {server.publisher}
            </span>
          )}
        </div>
        {server.description && (
          <div
            style={{
              fontSize: "var(--t-12)",
              color: "var(--ink-2)",
              lineHeight: 1.5,
              marginTop: 3,
            }}
          >
            {server.description}
          </div>
        )}
        {server.packageId && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--ink-3)",
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={server.packageId}
          >
            {server.packageId}
          </div>
        )}
      </div>
      <div style={{ justifySelf: "end" }}>
        {installed || state === "done" ? (
          <PidButton
            variant="ghost"
            disabled
            style={THIN_CTL}
            icon={<Check size={12} aria-hidden />}
          >
            {state === "done" ? "Added" : "Installed"}
          </PidButton>
        ) : state === "installing" ? (
          <PidButton variant="ghost" disabled style={THIN_CTL}>
            <span className="pid-mcp-installing-dot" style={{ marginRight: 7 }} aria-hidden />
            Installing…
          </PidButton>
        ) : (
          <PidButton
            variant="primary"
            longLabel
            style={THIN_CTL}
            icon={<Plus size={12} aria-hidden />}
            disabled={disabled}
            onClick={onInstall}
          >
            Install
          </PidButton>
        )}
      </div>
    </div>
  );
}
