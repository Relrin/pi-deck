import { type ReactNode, useState } from "react";
import { Files, List, Settings, Terminal } from "../components/icons";
import { Tooltip } from "../components/ui/Tooltip";
import { useSettingsStore } from "../features/settings/useSettingsStore";
import { useTerminalStore } from "../features/terminal/useTerminalStore";
import { isMacOs } from "../lib/platform";

type RailTab = "sessions" | "files";

export interface PidLeftRailProps {
  sessions: ReactNode;
  files: ReactNode;
  initialTab?: RailTab;
}

export function PidLeftRail({ sessions, files, initialTab = "sessions" }: PidLeftRailProps) {
  const [tab, setTab] = useState<RailTab>(initialTab);
  const settingsTooltip = `Settings (${isMacOs() ? "⌘" : "Ctrl"}+,)`;
  const terminalTooltip = `Toggle terminal (${isMacOs() ? "⌘" : "Ctrl"}+\`)`;

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
            <List size={14} aria-hidden />
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
            <Files size={14} aria-hidden />
          </span>
          Files
        </button>
      </div>

      <div className="pid-rail-body" role="tabpanel">
        {tab === "sessions" ? sessions : files}
      </div>

      <div className="pid-rail-footer">
        <Tooltip content={settingsTooltip}>
          <button
            type="button"
            className="pid-topbar-btn"
            aria-label="Open settings"
            onClick={() => useSettingsStore.getState().setOpen(true)}
          >
            <Settings size={14} aria-hidden />
          </button>
        </Tooltip>
        <Tooltip content={terminalTooltip}>
          <button
            type="button"
            className="pid-topbar-btn"
            aria-label="Toggle terminal panel"
            onClick={() => useTerminalStore.getState().togglePanel()}
          >
            <Terminal size={14} aria-hidden />
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
