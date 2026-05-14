import { SessionsList } from "../features/sessions/SessionsList";
import { usePanelState } from "./use-panel-state";

export function SessionsSidebar() {
  const collapsed = usePanelState((s) => s.left.collapsed);
  const toggle = usePanelState((s) => s.toggleLeft);

  if (collapsed) {
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
        borderRight: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <SessionsList />
      <button
        type="button"
        onClick={toggle}
        aria-label="Collapse sessions sidebar"
        title="Collapse"
        style={{
          alignSelf: "flex-end",
          color: "var(--color-text-subtle)",
          padding: "4px 8px",
          fontSize: 12,
          borderTop: "1px solid var(--color-border)",
        }}
      >
        {"‹ collapse"}
      </button>
    </aside>
  );
}
