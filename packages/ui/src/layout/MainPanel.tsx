import { DevConsole } from "../features/_dev/DevConsole";
import { useSessionsStore } from "../features/sessions/useSessionsStore";

export function MainPanel() {
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);

  if (activeSessionId) {
    return (
      <main
        style={{
          background: "var(--color-bg)",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          color: "var(--color-text)",
        }}
      >
        <p style={{ color: "var(--color-text-muted)" }}>Session {activeSessionId} is active</p>
      </main>
    );
  }

  return (
    <main
      style={{
        background: "var(--color-bg)",
        color: "var(--color-text)",
        overflow: "hidden",
      }}
    >
      <DevConsole />
    </main>
  );
}
