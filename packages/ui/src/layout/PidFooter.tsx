import { Glyph } from "../components/glyph";
import { useSessionsStore } from "../features/sessions/useSessionsStore";

export function PidFooter() {
  // Best-effort: surface the active session's project and id when available; fall back to
  // literal placeholders. Real branch/agent/model wiring lands in later plans.
  const activeSession = useSessionsStore((s) =>
    s.sessions.find((session) => session.id === s.activeSessionId),
  );
  const status = useSessionsStore((s) => s.status);

  const projectName = activeSession?.projectId ?? "—";
  const branchLabel = "—";
  const agentLabel = status === "connected" ? "ready" : status === "idle" ? "idle" : status;
  const modelLabel = "claude-opus-4-7";

  return (
    <footer className="pid-footer">
      <div className="seg">
        <Glyph kind="logo" size={12} />
        <span className="accent">pi-deck</span>
      </div>
      <div className="seg">
        <span className="lbl">project</span>
        <span>{projectName}</span>
      </div>
      <div className="seg">
        <span className="lbl">branch</span>
        <span>{branchLabel}</span>
      </div>
      <div className="seg">
        <span className="lbl">agent</span>
        <span>{agentLabel}</span>
      </div>
      <div className="spacer" />
      <div className="seg">
        <span className="lbl">model</span>
        <span>{modelLabel}</span>
      </div>
    </footer>
  );
}
