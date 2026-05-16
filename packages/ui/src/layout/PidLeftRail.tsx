import { type ReactNode, useState } from "react";
import { Glyph } from "../components/glyph";

type RailTab = "sessions" | "files";

export interface PidLeftRailProps {
  sessions: ReactNode;
  files: ReactNode;
  initialTab?: RailTab;
}

export function PidLeftRail({ sessions, files, initialTab = "sessions" }: PidLeftRailProps) {
  const [tab, setTab] = useState<RailTab>(initialTab);

  return (
    <aside className="pid-rail" aria-label="Left rail">
      <div className="pid-rail-tabs" role="tablist" aria-label="Left rail tabs">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "sessions"}
          className={`pid-rail-tab${tab === "sessions" ? " active" : ""}`}
          onClick={() => setTab("sessions")}
        >
          <span style={{ marginRight: 6, display: "inline-flex", verticalAlign: "-2px" }}>
            <Glyph kind="sessions" />
          </span>
          Sessions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "files"}
          className={`pid-rail-tab${tab === "files" ? " active" : ""}`}
          onClick={() => setTab("files")}
        >
          <span style={{ marginRight: 6, display: "inline-flex", verticalAlign: "-2px" }}>
            <Glyph kind="files" />
          </span>
          Files
        </button>
      </div>

      <div className="pid-rail-body" role="tabpanel">
        {tab === "sessions" ? sessions : files}
      </div>
    </aside>
  );
}
