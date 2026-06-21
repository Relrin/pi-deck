import type { PromptAttachment } from "@pi-deck/core/protocol/commands.js";
import { useEffect, useMemo } from "react";
import { ExternalLink, File, FolderOpen } from "../../components/icons";
import { useNotificationStore } from "../_status/useNotificationStore.js";
import { selectMessages, useMessagesStore } from "../chat/useMessagesStore.js";
import { selectSessionUsage, useUsageStore } from "../chat/useUsageStore.js";
import { selectPlanSession, usePlanStore } from "../plan-panel/usePlanStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import {
  type ContextBreakdown,
  computeContextBreakdown,
  formatTokens,
} from "./contextBreakdown.js";
import { type ArtefactRecord, selectArtefacts, useArtefactsStore } from "./useArtefactsStore.js";

interface PidContextPaneProps {
  /** Active session id, or `undefined` when no session is selected. */
  sessionId: string | undefined;
}

interface ScopeEntry {
  /** Stable key combining kind + path so the same path attached twice (file + folder) still
   *  collapses correctly when the path matches and the kind matches. */
  key: string;
  kind: PromptAttachment["kind"];
  path: string;
}

interface ArtefactEntry {
  key: string;
  path: string;
  displayName: string;
  /** `"plan"` flags the per-session plan markdown so it can be pinned to the top. */
  origin: "plan" | "tool";
}

/**
 * Right-pane Context tab. Three sections, in order:
 *   1. Context window — segmented bar driven by the same breakdown helper as the composer's
 *      `ContextUsageIndicator` ring tooltip, so both stay in lockstep.
 *   2. In scope — every file/folder attachment the user sent during the session, deduped.
 *   3. Artefacts produced — newly-created files reported by the host's `ArtefactsTracker`,
 *      plus the session's plan-mode markdown when it exists.
 *
 * Empty state (no active session) is rendered as a single placeholder so the tab doesn't show
 * three identical "no data" cards stacked on top of each other.
 */
export function PidContextPane({ sessionId }: PidContextPaneProps) {
  const usage = useUsageStore(selectSessionUsage(sessionId));
  const messages = useMessagesStore(selectMessages(sessionId));
  const artefacts = useArtefactsStore(selectArtefacts(sessionId));
  const planSession = usePlanStore(selectPlanSession(sessionId));
  const client = useSessionsStore((s) => s.client);

  // Prime the artefacts list on session change. Subsequent updates stream in via
  // `session.artefacts.changed`. We don't have to clear on absence — the store already returns
  // an empty list for unknown sessions, and the host emits an empty array on worker exit.
  useEffect(() => {
    if (!sessionId || !client) return;
    let cancelled = false;
    client
      .call("session.artefacts.list", { sessionId })
      .then((res) => {
        if (cancelled) return;
        useArtefactsStore.getState().setForSession(sessionId, res.artefacts);
      })
      .catch(() => {
        // Best-effort prime — the live event stream is the authoritative source.
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, client]);

  const breakdown = useMemo(
    () => computeContextBreakdown(usage?.context, messages, usage?.cost),
    [usage?.context, messages, usage?.cost],
  );

  const scope = useMemo(() => collectScope(messages), [messages]);
  const artefactRows = useMemo(
    () => collectArtefacts(artefacts, planSession.filePath, planSession.fileContent),
    [artefacts, planSession.filePath, planSession.fileContent],
  );

  if (!sessionId) {
    return <div className="pid-rightpane-placeholder">Start or open a session to see context.</div>;
  }

  const hasData = usage?.context !== undefined;
  const percent =
    hasData && breakdown.contextWindow > 0
      ? Math.min(100, Math.round((breakdown.used / breakdown.contextWindow) * 100))
      : 0;

  return (
    <div className="pid-context-pane">
      <ContextWindowSection
        breakdown={breakdown}
        percent={percent}
        active={hasData}
        mcpToolCount={usage?.cost?.mcpToolCount ?? 0}
      />
      <ScopeSection entries={scope} />
      <ArtefactsSection entries={artefactRows} />
    </div>
  );
}

function ContextWindowSection({
  breakdown,
  percent,
  active,
  mcpToolCount,
}: {
  breakdown: ContextBreakdown;
  percent: number;
  active: boolean;
  mcpToolCount: number;
}) {
  const { messages, systemPrompt, projectContext, tools, mcp, free, contextWindow, used } =
    breakdown;
  const basePrompt = systemPrompt - projectContext;
  const seg = (n: number): number => (contextWindow > 0 ? (n / contextWindow) * 100 : 0);
  const mcpPercent = contextWindow > 0 ? Math.round((mcp / contextWindow) * 100) : 0;
  return (
    <section className="pid-context-section">
      <div className="pid-mono-label pid-context-section-label">context window</div>
      <div className="pid-context-window-row">
        <span className={`pid-context-window-percent${active ? "" : " is-idle"}`}>{percent}%</span>
        <span className="pid-context-window-totals">
          {formatTokens(used)} / {formatTokens(contextWindow)} tok
        </span>
      </div>
      <div className="pid-context-bar" role="img" aria-label={`Context usage ${percent}%`}>
        <span
          className="pid-context-bar-segment pid-context-bar-system"
          style={{ width: `${seg(basePrompt)}%` }}
          title={`System prompt — ${formatTokens(basePrompt)} tok`}
        />
        <span
          className="pid-context-bar-segment pid-context-bar-project"
          style={{ width: `${seg(projectContext)}%` }}
          title={`Project context (AGENTS.md, CLAUDE.md, etc.) — ${formatTokens(projectContext)} tok`}
        />
        <span
          className="pid-context-bar-segment pid-context-bar-messages"
          style={{ width: `${seg(messages)}%` }}
          title={`Messages — ${formatTokens(messages)} tok`}
        />
        <span
          className="pid-context-bar-segment pid-context-bar-tools"
          style={{ width: `${seg(tools)}%` }}
          title={`Skills / tool definitions — ${formatTokens(tools)} tok`}
        />
        <span
          className="pid-context-bar-segment pid-context-bar-mcp"
          style={{ width: `${seg(mcp)}%` }}
          title={`MCP tools — ${formatTokens(mcp)} tok`}
        />
        <span
          className="pid-context-bar-segment pid-context-bar-free"
          style={{ width: `${seg(free)}%` }}
          title={`Free space — ${formatTokens(free)} tok`}
        />
      </div>
      <ul className="pid-context-legend">
        <li>
          <span className="pid-context-swatch pid-context-bar-system" />
          system
        </li>
        <li>
          <span className="pid-context-swatch pid-context-bar-project" />
          project
        </li>
        <li>
          <span className="pid-context-swatch pid-context-bar-messages" />
          chat
        </li>
        <li>
          <span className="pid-context-swatch pid-context-bar-tools" />
          tools
        </li>
        <li>
          <span className="pid-context-swatch pid-context-bar-mcp" />
          mcp
        </li>
        <li>
          <span className="pid-context-swatch pid-context-bar-free" />
          free
        </li>
      </ul>
    </section>
  );
}

function ScopeSection({ entries }: { entries: ScopeEntry[] }) {
  return (
    <section className="pid-context-section">
      <div className="pid-context-section-head">
        <span className="pid-mono-label">in scope · {entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <p className="pid-context-empty">
          No files or folders attached yet. Drag from the file tree to share context with pi.
        </p>
      ) : (
        <ul className="pid-context-rows">
          {entries.map((entry) => (
            <li key={entry.key} className="pid-context-row">
              <span className="pid-tag pid-context-row-tag">{tagLabel(entry.kind)}</span>
              <span className="pid-context-row-path" title={entry.path}>
                {displayPath(entry.path)}
              </span>
              <RowActions path={entry.path} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ArtefactsSection({ entries }: { entries: ArtefactEntry[] }) {
  return (
    <section className="pid-context-section">
      <div className="pid-context-section-head">
        <span className="pid-mono-label">artefacts produced · {entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <p className="pid-context-empty">
          Nothing produced yet. New files the agent writes (plans, reports, generated code…) will
          appear here.
        </p>
      ) : (
        <ul className="pid-context-rows">
          {entries.map((entry) => (
            <li key={entry.key} className="pid-context-row">
              <File size={12} aria-hidden className="pid-context-row-icon" />
              <span className="pid-context-row-path" title={entry.path}>
                {entry.displayName}
              </span>
              <RowActions path={entry.path} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RowActions({ path }: { path: string }) {
  return (
    <span className="pid-context-row-actions">
      <button
        type="button"
        className="pid-context-row-action"
        title="Open with default app"
        aria-label={`Open ${path}`}
        onClick={() => void openWithDefault(path)}
      >
        <ExternalLink size={11} aria-hidden />
      </button>
      <button
        type="button"
        className="pid-context-row-action"
        title="Reveal in file manager"
        aria-label={`Reveal ${path} in file manager`}
        onClick={() => void revealInFolder(path)}
      >
        <FolderOpen size={11} aria-hidden />
      </button>
    </span>
  );
}

function tagLabel(kind: PromptAttachment["kind"]): string {
  switch (kind) {
    case "file":
      return "file";
    case "folder":
      return "dir";
    case "repo-ref":
      return "ref";
  }
}

function displayPath(absPath: string): string {
  // Drop the drive prefix on Windows + leading slashes so the row reads as a relative-ish
  // path without us hardcoding a project root prefix to strip.
  const normalised = absPath.replace(/\\/g, "/");
  return normalised;
}

function basename(absPath: string): string {
  const last = absPath
    .replace(/[\\/]+$/, "")
    .split(/[\\/]/)
    .pop();
  return last && last.length > 0 ? last : absPath;
}

function collectScope(
  messages: ReadonlyArray<{ kind: string; attachments?: PromptAttachment[] }>,
): ScopeEntry[] {
  const seen = new Map<string, ScopeEntry>();
  for (const m of messages) {
    if (m.kind !== "user" || !m.attachments) continue;
    for (const att of m.attachments) {
      const key = `${att.kind}:${att.path}`;
      if (seen.has(key)) continue;
      seen.set(key, { key, kind: att.kind, path: att.path });
    }
  }
  return [...seen.values()];
}

function collectArtefacts(
  artefacts: ReadonlyArray<ArtefactRecord>,
  planFilePath: string | null,
  planFileContent: string | null,
): ArtefactEntry[] {
  const entries: ArtefactEntry[] = [];
  // Pin the plan file at the top when the session has produced one. It's the single artefact
  // users iterate on, so it deserves the lead row even before tool-driven artefacts show up.
  if (planFilePath && planFileContent !== null) {
    entries.push({
      key: `plan:${planFilePath}`,
      path: planFilePath,
      displayName: basename(planFilePath),
      origin: "plan",
    });
  }
  for (const a of artefacts) {
    // Don't double-render the plan file as both "plan" and "tool" artefact — the plan watcher
    // and the tool tracker can both fire for the same path when the agent writes it.
    if (planFilePath && samePath(a.path, planFilePath)) continue;
    entries.push({
      key: `tool:${a.path}`,
      path: a.path,
      displayName: basename(a.path),
      origin: "tool",
    });
  }
  return entries;
}

function samePath(a: string, b: string): boolean {
  return a.replace(/\\/g, "/") === b.replace(/\\/g, "/");
}

async function openWithDefault(path: string): Promise<void> {
  const bridge = window.bridge;
  if (!bridge?.openPath) {
    useNotificationStore.getState().error("Opening files is not supported on this platform.");
    return;
  }
  try {
    const err = await bridge.openPath(path);
    if (err) useNotificationStore.getState().error(err);
  } catch (err) {
    useNotificationStore
      .getState()
      .error(err instanceof Error ? err.message : "Failed to open file");
  }
}

async function revealInFolder(path: string): Promise<void> {
  const bridge = window.bridge;
  if (!bridge?.showItemInFolder) {
    useNotificationStore.getState().error("Reveal in file manager is not supported here.");
    return;
  }
  try {
    await bridge.showItemInFolder(path);
  } catch (err) {
    useNotificationStore
      .getState()
      .error(err instanceof Error ? err.message : "Failed to reveal file");
  }
}
