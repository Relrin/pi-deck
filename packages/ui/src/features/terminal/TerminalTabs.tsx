import type { TerminalShell } from "@pi-deck/core/protocol/commands.js";
import { useRef, useState } from "react";
import { X } from "../../components/icons/index.js";
import { Tooltip } from "../../components/ui/Tooltip.js";
import { NewTerminalButton } from "./NewTerminalButton.js";
import { ShellTypeIcon } from "./terminalShellIcon.js";
import { type TerminalTab, useTerminalStore } from "./useTerminalStore.js";

function basename(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] || p;
}

/** Derive a shell kind from a spawned shell path, so default tabs (no picked shell) get an icon. */
function kindFromPath(p: string): string | undefined {
  const norm = p.toLowerCase().replace(/\\/g, "/");
  const base = (norm.split("/").pop() ?? "").replace(/\.(exe|cmd|bat|com)$/, "");
  if (base === "pwsh" || base === "powershell") return "powershell";
  if (base === "cmd") return "cmd";
  if (base === "bash") return norm.includes("/git/") ? "gitbash" : "bash";
  if (base === "zsh") return "zsh";
  if (base === "fish") return "fish";
  if (base === "sh") return "sh";
  if (base === "wsl") return "wsl";
  return undefined;
}

/** Shell kind + label used to pick the tab's icon. */
function tabIconMeta(tab: TerminalTab): { kind: string | undefined; label: string } {
  if (tab.requestedShell) return { kind: tab.requestedShell.kind, label: tab.requestedShell.label };
  if (tab.shell) return { kind: kindFromPath(tab.shell), label: basename(tab.shell) };
  return { kind: undefined, label: "shell" };
}

/** The shell label, used when the user hasn't renamed the tab. */
function shellLabel(tab: TerminalTab): string {
  if (tab.requestedShell?.label) return tab.requestedShell.label;
  if (!tab.shell) return "shell";
  return basename(tab.shell).replace(/\.(exe|cmd|bat|com)$/i, "");
}

/** The name shown on the tab: the user's override if set, else the derived shell label. */
function displayLabel(tab: TerminalTab): string {
  return tab.title?.trim() || shellLabel(tab);
}

export interface TerminalTabsProps {
  tabs: TerminalTab[];
  activeTabId: string | null;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  /** Open a new terminal; pass a shell to launch that kind, omit for the default shell. */
  onNew: (shell?: TerminalShell) => void;
  /** Whether a new terminal can be created right now (false when no project is open). */
  canCreate: boolean;
  onClosePanel: () => void;
}

export function TerminalTabs({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onNew,
  canCreate,
  onClosePanel,
}: TerminalTabsProps) {
  const renameTab = useTerminalStore((s) => s.renameTab);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Set on Escape so the input's blur handler skips the commit (reverting the edit).
  const cancelled = useRef(false);

  const startEdit = (tabId: string) => {
    cancelled.current = false;
    setEditingId(tabId);
  };
  const finishEdit = (tabId: string, value: string) => {
    if (!cancelled.current) renameTab(tabId, value);
    setEditingId(null);
  };

  return (
    <div className="pid-terminal-tabs" role="tablist" aria-label="Terminal tabs">
      <div className="pid-terminal-tabs-strip">
        {tabs.map((tab) => {
          const label = displayLabel(tab);
          const icon = tabIconMeta(tab);
          const editing = editingId === tab.tabId;
          return (
            <div
              key={tab.tabId}
              role="tab"
              aria-selected={tab.tabId === activeTabId}
              tabIndex={-1}
              className={`pid-terminal-tab${tab.tabId === activeTabId ? " active" : ""}${tab.exited ? " exited" : ""}`}
              onMouseDown={() => onSelect(tab.tabId)}
              onDoubleClick={() => startEdit(tab.tabId)}
            >
              <span className="pid-terminal-tab-icon" aria-hidden>
                <ShellTypeIcon kind={icon.kind} label={icon.label} size={13} />
              </span>
              {editing ? (
                <input
                  className="pid-terminal-tab-rename"
                  defaultValue={label}
                  aria-label="Rename terminal"
                  // biome-ignore lint/a11y/noAutofocus: focus the field the instant rename begins
                  autoFocus
                  onFocus={(e) => e.currentTarget.select()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  onBlur={(e) => finishEdit(tab.tabId, e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    else if (e.key === "Escape") {
                      cancelled.current = true;
                      e.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <span className="pid-terminal-tab-label" title={label}>
                  {label}
                </span>
              )}
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
        <NewTerminalButton onNew={onNew} disabled={!canCreate} />
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
