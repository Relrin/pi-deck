import type { ComponentType } from "react";
import { useState } from "react";
import { Box, Folder, GitBranch } from "../components/icons/index.js";
import { usePanelState } from "./use-panel-state.legacy";

type TabId = "git" | "files" | "context";

type TabIcon = ComponentType<{ size?: number; "aria-hidden"?: boolean }>;

const TABS: { id: TabId; label: string; Icon: TabIcon }[] = [
  { id: "git", label: "Git", Icon: GitBranch },
  { id: "files", label: "Files", Icon: Folder },
  { id: "context", label: "Context", Icon: Box },
];

interface ContextSidebarProps {
  onCloseDrawer?: () => void;
}

export function ContextSidebar({ onCloseDrawer }: ContextSidebarProps = {}) {
  const collapsed = usePanelState((s) => s.right.collapsed);
  const toggle = usePanelState((s) => s.toggleRight);
  const [active, setActive] = useState<TabId>("git");
  const inDrawer = onCloseDrawer !== undefined;

  if (collapsed && !inDrawer) {
    return (
      <aside
        aria-label="Context (collapsed)"
        style={{
          background: "var(--color-panel)",
          borderLeft: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: "var(--space-3)",
        }}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label="Expand context sidebar"
          title="Expand context"
          style={{
            width: 28,
            height: 28,
            borderRadius: "var(--radius-sm)",
            color: "var(--color-text-muted)",
            display: "grid",
            placeItems: "center",
            transition: "background-color 150ms ease",
          }}
        >
          {"‹"}
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Context"
      style={{
        background: "var(--color-panel)",
        borderLeft: inDrawer ? "none" : "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 40,
          padding: "0 var(--space-3)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div role="tablist" aria-label="Context panels" style={{ display: "flex", gap: 2 }}>
          {TABS.map((tab) => {
            const isActive = active === tab.id;
            const Icon = tab.Icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(tab.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: "var(--radius-sm)",
                  color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
                  background: isActive ? "var(--color-panel-2)" : "transparent",
                  transition: "background-color 150ms ease, color 150ms ease",
                }}
              >
                <Icon size={12} aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={inDrawer ? onCloseDrawer : toggle}
          aria-label={inDrawer ? "Close context drawer" : "Collapse context sidebar"}
          title={inDrawer ? "Close" : "Collapse"}
          style={{
            color: "var(--color-text-subtle)",
            padding: "2px 6px",
            borderRadius: "var(--radius-sm)",
            transition: "color 150ms ease",
          }}
        >
          {inDrawer ? "Close" : "›"}
        </button>
      </header>
      <div
        role="tabpanel"
        style={{
          flex: 1,
          padding: "var(--space-4)",
          color: "var(--color-text-subtle)",
          fontSize: 13,
          overflow: "auto",
        }}
      >
        {active === "git" && "Git status will appear here."}
        {active === "files" && "Project files will appear here."}
        {active === "context" && "Active context will appear here."}
      </div>
    </aside>
  );
}
