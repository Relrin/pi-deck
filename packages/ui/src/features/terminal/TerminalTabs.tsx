import { Plus, X } from "../../components/icons/index.js";
import { Tooltip } from "../../components/ui/Tooltip.js";
import type { TerminalTab } from "./useTerminalStore.js";

function basename(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] || p;
}

function shellLabel(tab: TerminalTab): string {
  if (!tab.shell) return "shell";
  return basename(tab.shell).replace(/\.(exe|cmd|bat|com)$/i, "");
}

export interface TerminalTabsProps {
  tabs: TerminalTab[];
  activeTabId: string | null;
  /** Display name of the active project, used in the "shell — project" tab label. */
  projectName: string | null;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onNew: () => void;
  onClosePanel: () => void;
}

export function TerminalTabs({
  tabs,
  activeTabId,
  projectName,
  onSelect,
  onClose,
  onNew,
  onClosePanel,
}: TerminalTabsProps) {
  return (
    <div className="pid-terminal-tabs" role="tablist" aria-label="Terminal tabs">
      <div className="pid-terminal-tabs-strip">
        {tabs.map((tab) => {
          const label = projectName ? `${shellLabel(tab)} — ${projectName}` : shellLabel(tab);
          return (
            <div
              key={tab.tabId}
              role="tab"
              aria-selected={tab.tabId === activeTabId}
              tabIndex={-1}
              className={`pid-terminal-tab${tab.tabId === activeTabId ? " active" : ""}${tab.exited ? " exited" : ""}`}
              onMouseDown={() => onSelect(tab.tabId)}
            >
              <span className="pid-terminal-tab-label">{label}</span>
              <button
                type="button"
                className="pid-terminal-tab-close"
                aria-label={`Close ${label}`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onClose(tab.tabId);
                }}
              >
                <X size={11} aria-hidden />
              </button>
            </div>
          );
        })}
        <Tooltip content="New terminal">
          <button
            type="button"
            className="pid-terminal-tab-new"
            aria-label="New terminal"
            onClick={onNew}
          >
            <Plus size={13} aria-hidden />
          </button>
        </Tooltip>
      </div>
      <div className="pid-terminal-tabs-actions">
        <Tooltip content="Close panel (Ctrl+`)">
          <button
            type="button"
            className="pid-terminal-tab-close"
            aria-label="Close terminal panel"
            onClick={onClosePanel}
          >
            <X size={13} aria-hidden />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
