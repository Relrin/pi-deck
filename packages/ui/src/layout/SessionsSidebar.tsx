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
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-3) var(--space-4)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <span
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--color-text-muted)",
            fontWeight: 600,
          }}
        >
          Sessions
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-label="Collapse sessions sidebar"
          title="Collapse"
          style={{
            color: "var(--color-text-subtle)",
            padding: "2px 6px",
            borderRadius: "var(--radius-sm)",
          }}
        >
          {"‹"}
        </button>
      </header>
      <div
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: "var(--space-5)",
          color: "var(--color-text-subtle)",
          fontSize: 13,
        }}
      >
        No project open
      </div>
    </aside>
  );
}
