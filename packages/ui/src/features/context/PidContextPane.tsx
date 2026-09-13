import type { PromptAttachment } from "@pi-deck/core/protocol/commands.js";
import { useEffect, useMemo } from "react";
import { ExternalLink, File, FolderOpen } from "../../components/icons";
import { useI18nContext } from "../../i18n/i18n-react.js";
import type { TranslationFunctions } from "../../i18n/i18n-types.js";
import { selectMessages, useMessagesStore } from "../chat/useMessagesStore.js";
import { selectSessionUsage, useUsageStore } from "../chat/useUsageStore.js";
import { selectPlanSession, usePlanStore } from "../plan-panel/usePlanStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import {
  type ContextBreakdown,
  computeContextBreakdown,
  formatTokens,
} from "./contextBreakdown.js";
import { openWithDefault, revealInFolder } from "./openExternal.js";
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
  const { LL } = useI18nContext();
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
    return <div className="pid-rightpane-placeholder">{LL.context.empty()}</div>;
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
  const { LL } = useI18nContext();
  const { messages, systemPrompt, projectContext, tools, mcp, free, contextWindow, used } =
    breakdown;
  const basePrompt = systemPrompt - projectContext;
  const seg = (n: number): number => (contextWindow > 0 ? (n / contextWindow) * 100 : 0);
  return (
    <section className="pid-context-section">
      <div className="pid-mono-label pid-context-section-label">{LL.context.window.label()}</div>
      <div className="pid-context-window-row">
        <span className={`pid-context-window-percent${active ? "" : " is-idle"}`}>{percent}%</span>
        <span className="pid-context-window-totals">
          {LL.context.window.totals({
            used: formatTokens(used),
            total: formatTokens(contextWindow),
          })}
        </span>
      </div>
      <div className="pid-context-bar" role="img" aria-label={LL.context.window.usage({ percent })}>
        <span
          className="pid-context-bar-segment pid-context-bar-system"
          style={{ width: `${seg(basePrompt)}%` }}
          title={LL.context.window.tooltip.system({ tokens: formatTokens(basePrompt) })}
        />
        <span
          className="pid-context-bar-segment pid-context-bar-project"
          style={{ width: `${seg(projectContext)}%` }}
          title={LL.context.window.tooltip.project({ tokens: formatTokens(projectContext) })}
        />
        <span
          className="pid-context-bar-segment pid-context-bar-messages"
          style={{ width: `${seg(messages)}%` }}
          title={LL.context.window.tooltip.messages({ tokens: formatTokens(messages) })}
        />
        <span
          className="pid-context-bar-segment pid-context-bar-tools"
          style={{ width: `${seg(tools)}%` }}
          title={LL.context.window.tooltip.tools({ tokens: formatTokens(tools) })}
        />
        <span
          className="pid-context-bar-segment pid-context-bar-mcp"
          style={{ width: `${seg(mcp)}%` }}
          title={LL.context.window.tooltip.mcp({ tokens: formatTokens(mcp) })}
        />
        <span
          className="pid-context-bar-segment pid-context-bar-free"
          style={{ width: `${seg(free)}%` }}
          title={LL.context.window.tooltip.free({ tokens: formatTokens(free) })}
        />
      </div>
      <ul className="pid-context-legend">
        <li>
          <span className="pid-context-swatch pid-context-bar-system" />
          {LL.context.window.legend.system()}
        </li>
        <li>
          <span className="pid-context-swatch pid-context-bar-project" />
          {LL.context.window.legend.project()}
        </li>
        <li>
          <span className="pid-context-swatch pid-context-bar-messages" />
          {LL.context.window.legend.chat()}
        </li>
        <li>
          <span className="pid-context-swatch pid-context-bar-tools" />
          {LL.context.window.legend.tools()}
        </li>
        <li>
          <span className="pid-context-swatch pid-context-bar-mcp" />
          {LL.context.window.legend.mcp()}
          {mcpToolCount > 0 ? ` · ${mcpToolCount}` : ""}
        </li>
        <li>
          <span className="pid-context-swatch pid-context-bar-free" />
          {LL.context.window.legend.free()}
        </li>
      </ul>
    </section>
  );
}

function ScopeSection({ entries }: { entries: ScopeEntry[] }) {
  const { LL } = useI18nContext();
  return (
    <section className="pid-context-section">
      <div className="pid-context-section-head">
        <span className="pid-mono-label">{LL.context.scope.label({ count: entries.length })}</span>
      </div>
      {entries.length === 0 ? (
        <p className="pid-context-empty">{LL.context.scope.empty()}</p>
      ) : (
        <ul className="pid-context-rows">
          {entries.map((entry) => (
            <li key={entry.key} className="pid-context-row">
              <span className="pid-tag pid-context-row-tag">{tagLabel(LL, entry.kind)}</span>
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
  const { LL } = useI18nContext();
  return (
    <section className="pid-context-section">
      <div className="pid-context-section-head">
        <span className="pid-mono-label">
          {LL.context.artefacts.label({ count: entries.length })}
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="pid-context-empty">{LL.context.artefacts.empty()}</p>
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
  const { LL } = useI18nContext();
  return (
    <span className="pid-context-row-actions">
      <button
        type="button"
        className="pid-context-row-action"
        title={LL.context.row.openTitle()}
        aria-label={LL.context.row.open({ path })}
        onClick={() => void openWithDefault(path)}
      >
        <ExternalLink size={11} aria-hidden />
      </button>
      <button
        type="button"
        className="pid-context-row-action"
        title={LL.context.row.revealTitle()}
        aria-label={LL.context.row.reveal({ path })}
        onClick={() => void revealInFolder(path)}
      >
        <FolderOpen size={11} aria-hidden />
      </button>
    </span>
  );
}

function tagLabel(t: TranslationFunctions, kind: PromptAttachment["kind"]): string {
  switch (kind) {
    case "file":
      return t.context.tag.file();
    case "folder":
      return t.context.tag.folder();
    case "repo-ref":
      return t.context.tag.repoRef();
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
