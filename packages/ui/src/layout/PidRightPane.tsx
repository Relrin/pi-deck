import { type ReactNode, useState } from "react";
import { GitBranch, Layers } from "../components/icons";

type RightTab = "git" | "context";

export interface PidRightPaneProps {
  git: ReactNode;
  context: ReactNode;
  gitCount?: number;
  contextCount?: number;
  initialTab?: RightTab;
}

export function PidRightPane({
  git,
  context,
  gitCount,
  contextCount,
  initialTab = "context",
}: PidRightPaneProps) {
  const [tab, setTab] = useState<RightTab>(initialTab);

  return (
    <aside className="pid-rightpane" aria-label="Right pane">
      <div className="pid-right-tabs" role="tablist" aria-label="Right pane tabs">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "git"}
          className={`pid-right-tab${tab === "git" ? " active" : ""}`}
          onClick={() => setTab("git")}
        >
          <GitBranch size={14} aria-hidden />
          Git
          {gitCount !== undefined && <span className="count">{gitCount}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "context"}
          className={`pid-right-tab${tab === "context" ? " active" : ""}`}
          onClick={() => setTab("context")}
        >
          <Layers size={14} aria-hidden />
          Context
          {contextCount !== undefined && <span className="count">{contextCount}</span>}
        </button>
      </div>

      <div className="pid-right-body" role="tabpanel">
        {tab === "git" ? git : context}
      </div>
    </aside>
  );
}
