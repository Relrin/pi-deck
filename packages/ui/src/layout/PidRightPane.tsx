import { type ReactNode, useEffect, useRef } from "react";
import { GitBranch, Layers, MessageSquare } from "../components/icons";
import { useSessionsStore } from "../features/sessions/useSessionsStore";
import { useI18nContext } from "../i18n/i18n-react";
import { usePreferencesStore } from "../theme/usePreferencesStore";
import { type RightPaneTab, useRightPaneStore } from "./use-right-pane";

export interface PidRightPaneProps {
  git: ReactNode;
  context: ReactNode;
  /** Docked chat surface. Only shown in IDE mode, as the first tab. */
  chat?: ReactNode;
  gitCount?: number;
  contextCount?: number;
}

export function PidRightPane({ git, context, chat, gitCount, contextCount }: PidRightPaneProps) {
  const { LL } = useI18nContext();
  const tab = useRightPaneStore((s) => s.tab);
  const setTab = useRightPaneStore((s) => s.setTab);
  const ide = usePreferencesStore((s) => s.viewMode) === "ide";
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);

  // The chat tab only exists in IDE mode. If a persisted "chat" selection survives a
  // switch back to agent mode, fall back to Git so the body still has something to show.
  useEffect(() => {
    if (!ide && tab === "chat") setTab("git");
  }, [ide, tab, setTab]);

  // Opening a different session in IDE mode focuses the docked chat so the new
  // conversation is visible. Ref-guarded so it doesn't override a persisted tab on mount.
  const prevSession = useRef(activeSessionId);
  useEffect(() => {
    if (ide && activeSessionId && activeSessionId !== prevSession.current) {
      setTab("chat");
    }

    prevSession.current = activeSessionId;
  }, [ide, activeSessionId, setTab]);

  const effectiveTab: RightPaneTab = !ide && tab === "chat" ? "git" : tab;

  return (
    <aside className="pid-rightpane" aria-label={LL.shell.rightPane.label()}>
      <div className="pid-right-tabs" role="tablist" aria-label={LL.shell.rightPane.tabs()}>
        {ide && (
          <button
            type="button"
            role="tab"
            aria-selected={effectiveTab === "chat"}
            className={`pid-right-tab${effectiveTab === "chat" ? " active" : ""}`}
            onClick={() => setTab("chat")}
          >
            <MessageSquare size={14} aria-hidden />
            {LL.shell.rightPane.session()}
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={effectiveTab === "git"}
          className={`pid-right-tab${effectiveTab === "git" ? " active" : ""}`}
          onClick={() => setTab("git")}
        >
          <GitBranch size={14} aria-hidden />
          {LL.shell.rightPane.git()}
          {gitCount !== undefined && <span className="count">{gitCount}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={effectiveTab === "context"}
          className={`pid-right-tab${effectiveTab === "context" ? " active" : ""}`}
          onClick={() => setTab("context")}
        >
          <Layers size={14} aria-hidden />
          {LL.shell.rightPane.context()}
          {contextCount !== undefined && <span className="count">{contextCount}</span>}
        </button>
      </div>

      <div className="pid-right-body" role="tabpanel" data-tab={effectiveTab}>
        {effectiveTab === "chat" ? chat : effectiveTab === "git" ? git : context}
      </div>
    </aside>
  );
}
