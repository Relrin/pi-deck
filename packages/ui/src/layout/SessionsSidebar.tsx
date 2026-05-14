import { SessionsList } from "../features/sessions/SessionsList";
import { usePanelState } from "./use-panel-state";

interface SessionsSidebarProps {
  /** Provided when rendered as a drawer overlay (narrow viewports). */
  onCloseDrawer?: () => void;
}

export function SessionsSidebar({ onCloseDrawer }: SessionsSidebarProps = {}) {
  const collapsed = usePanelState((s) => s.left.collapsed);
  const toggle = usePanelState((s) => s.toggleLeft);
  const inDrawer = onCloseDrawer !== undefined;

  if (collapsed && !inDrawer) {
    return (
      <aside
        aria-label="Sessions (collapsed)"
        style={{
          background: "var(--color-panel)",
          borderRight: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: "var(--space-3)",
        }}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label="Expand sessions sidebar"
          title="Expand sessions"
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
          {"›"}
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Sessions"
      style={{
        background: "var(--color-panel)",
        borderRight: inDrawer ? "none" : "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
      }}
    >
      <SessionsList />
      <button
        type="button"
        onClick={inDrawer ? onCloseDrawer : toggle}
        aria-label={inDrawer ? "Close sessions drawer" : "Collapse sessions sidebar"}
        title={inDrawer ? "Close" : "Collapse"}
        style={{
          alignSelf: "flex-end",
          color: "var(--color-text-subtle)",
          padding: "4px 8px",
          fontSize: 12,
          borderTop: "1px solid var(--color-border)",
          transition: "color 150ms ease",
        }}
      >
        {inDrawer ? "Close" : "‹ collapse"}
      </button>
    </aside>
  );
}
