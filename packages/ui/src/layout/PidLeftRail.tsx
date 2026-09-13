import { type ReactNode, useState } from "react";
import { Files, List, Settings, Terminal } from "../components/icons";
import { Tooltip } from "../components/ui/Tooltip";
import { useSettingsStore } from "../features/settings/useSettingsStore";
import { useTerminalStore } from "../features/terminal/useTerminalStore";
import { useI18nContext } from "../i18n/i18n-react";
import { metaSymbol } from "../lib/platform";

type RailTab = "sessions" | "files";

export interface PidLeftRailProps {
  sessions: ReactNode;
  files: ReactNode;
  initialTab?: RailTab;
}

export function PidLeftRail({ sessions, files, initialTab = "sessions" }: PidLeftRailProps) {
  const { LL } = useI18nContext();
  const [tab, setTab] = useState<RailTab>(initialTab);
  // The modifier glyph is a key name, not copy — interpolated into the translated tooltip.
  const settingsTooltip = LL.shell.settings.shortcutTooltip({ mod: metaSymbol() });
  const terminalTooltip = LL.shell.terminal.shortcutTooltip({ mod: metaSymbol() });

  return (
    <aside className="pid-rail" aria-label={LL.shell.leftRail.label()}>
      <div className="pid-rail-tabs" role="tablist" aria-label={LL.shell.leftRail.tabs()}>
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
          {LL.shell.leftRail.sessions()}
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
          {LL.shell.leftRail.files()}
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
            aria-label={LL.shell.settings.open()}
            onClick={() => useSettingsStore.getState().setOpen(true)}
          >
            <Settings size={14} aria-hidden />
          </button>
        </Tooltip>
        <Tooltip content={terminalTooltip}>
          <button
            type="button"
            className="pid-topbar-btn"
            aria-label={LL.shell.terminal.toggle()}
            onClick={(event) => {
              useTerminalStore.getState().togglePanel();
              event.currentTarget.blur();
            }}
          >
            <Terminal size={14} aria-hidden />
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
