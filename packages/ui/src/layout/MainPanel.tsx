export function MainPanel() {
  return (
    <main
      style={{
        background: "var(--color-bg)",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
      }}
    >
      <div style={{ textAlign: "center", padding: "var(--space-6)" }}>
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 600,
            color: "var(--color-text)",
            letterSpacing: "-0.01em",
          }}
        >
          Welcome to pi-deck
        </h1>
        <p
          style={{
            marginTop: "var(--space-3)",
            color: "var(--color-text-muted)",
            fontSize: 14,
            maxWidth: 420,
          }}
        >
          A desktop client for the pi coding agent. Open a project to begin.
        </p>
      </div>
    </main>
  );
}
