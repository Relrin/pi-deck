import { useEffect } from "react";
import { useProjectsStore } from "../sessions/useProjectsStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { TerminalTabs } from "./TerminalTabs.js";
import { TerminalView } from "./TerminalView.js";
import { activeProjectName, resolveDefaultCwd } from "./terminalCwd.js";
import { useTerminalStore } from "./useTerminalStore.js";

function newTabId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

/**
 * Root of the bottom terminal dock: the tab strip plus the active tab's `TerminalView`. Owns
 * tab lifecycle (open/close) and ensures at least one tab exists while the panel is open and a
 * project is available. Only the active tab is mounted; switching remounts (repaint from the
 * host buffer snapshot).
 */
export function TerminalPane() {
  const scope = useTerminalStore((s) => s.bySession[s.currentKey]);
  const addTab = useTerminalStore((s) => s.addTab);
  const ensureTab = useTerminalStore((s) => s.ensureTab);
  const removeTab = useTerminalStore((s) => s.removeTab);
  const setActiveTab = useTerminalStore((s) => s.setActiveTab);
  const setOpen = useTerminalStore((s) => s.setOpen);
  // Re-render labels/empty-state when the active project changes.
  useProjectsStore((s) => s.activeProjectId);

  const tabs = scope?.tabs ?? [];
  const activeTabId = scope?.activeTabId ?? null;
  const activeTab = tabs.find((t) => t.tabId === activeTabId) ?? null;
  const cwd = resolveDefaultCwd();

  // Open a default tab when the panel is shown with none yet (and a project is available).
  useEffect(() => {
    if (tabs.length === 0 && cwd) {
      ensureTab({ tabId: newTabId(), cwd, terminalId: null });
    }
  }, [tabs.length, cwd, ensureTab]);

  const onNew = () => {
    if (!cwd) return;
    addTab({ tabId: newTabId(), cwd, terminalId: null });
  };

  const onClose = (tabId: string) => {
    const tab = tabs.find((t) => t.tabId === tabId);
    const client = useSessionsStore.getState().client;
    if (tab?.terminalId && client)
      void client.terminal.close(tab.terminalId).catch(() => undefined);

    // Closing the last terminal dismisses the whole panel
    if (tabs.length <= 1) setOpen(false);
    removeTab(tabId);
  };

  return (
    <div className="pid-terminal-pane">
      <TerminalTabs
        tabs={tabs}
        activeTabId={activeTabId}
        projectName={activeProjectName()}
        onSelect={setActiveTab}
        onClose={onClose}
        onNew={onNew}
        onClosePanel={() => setOpen(false)}
      />
      <div className="pid-terminal-body">
        {activeTab ? (
          <TerminalView key={activeTab.tabId} tab={activeTab} />
        ) : (
          <div className="pid-terminal-empty">
            {cwd ? "Starting terminal…" : "Open a project to start a terminal."}
          </div>
        )}
      </div>
    </div>
  );
}
