import { useCallback, useEffect, useMemo, useState } from "react";
import { useSessionsStore } from "../sessions/useSessionsStore";

const surface: React.CSSProperties = {
  background: "var(--color-surface, #16181d)",
  color: "var(--color-text, #e6e6e6)",
  border: "1px solid var(--color-border, #2a2d33)",
  borderRadius: 8,
  padding: 16,
};

const buttonStyle: React.CSSProperties = {
  background: "var(--color-surface-elevated, #20232a)",
  color: "var(--color-text, #e6e6e6)",
  border: "1px solid var(--color-border, #2a2d33)",
  borderRadius: 6,
  padding: "6px 12px",
  cursor: "pointer",
  fontSize: 13,
};

const inputStyle: React.CSSProperties = {
  background: "var(--color-bg, #0e0f12)",
  color: "var(--color-text, #e6e6e6)",
  border: "1px solid var(--color-border, #2a2d33)",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 13,
  flex: 1,
};

const STATUS_COLOR: Record<string, string> = {
  idle: "#777",
  connecting: "#d4a017",
  connected: "#3fb950",
  disconnected: "#d97706",
  "auth-failed": "#f85149",
};

export function DevConsole() {
  const status = useSessionsStore((s) => s.status);
  const eventLog = useSessionsStore((s) => s.eventLog);
  const hostVersion = useSessionsStore((s) => s.hostVersion);
  const protocolVersion = useSessionsStore((s) => s.protocolVersion);
  const activeProject = useSessionsStore((s) => s.activeProject);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const initError = useSessionsStore((s) => s.initError);

  const initialize = useSessionsStore((s) => s.initialize);
  const pingHost = useSessionsStore((s) => s.pingHost);
  const openProject = useSessionsStore((s) => s.openProject);
  const createSession = useSessionsStore((s) => s.createSession);
  const sendPrompt = useSessionsStore((s) => s.sendPrompt);
  const cancelPrompt = useSessionsStore((s) => s.cancelPrompt);
  const clearEventLog = useSessionsStore((s) => s.clearEventLog);

  const [projectPath, setProjectPath] = useState("");
  const [promptText, setPromptText] = useState("List files in the current directory.");
  const [latencyMs, setLatencyMs] = useState<number | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const handlePing = useCallback(async () => {
    setActionError(undefined);
    const start = performance.now();
    try {
      await pingHost();
      setLatencyMs(Math.round(performance.now() - start));
    } catch (err) {
      setActionError((err as Error).message);
    }
  }, [pingHost]);

  const handleOpenProject = useCallback(async () => {
    setActionError(undefined);
    try {
      await openProject(projectPath);
    } catch (err) {
      setActionError((err as Error).message);
    }
  }, [openProject, projectPath]);

  const handleCreateSession = useCallback(async () => {
    setActionError(undefined);
    try {
      await createSession();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }, [createSession]);

  const handleSendPrompt = useCallback(async () => {
    setActionError(undefined);
    try {
      await sendPrompt(promptText);
    } catch (err) {
      setActionError((err as Error).message);
    }
  }, [sendPrompt, promptText]);

  const handleCancel = useCallback(async () => {
    setActionError(undefined);
    try {
      await cancelPrompt();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }, [cancelPrompt]);

  const reversedLog = useMemo(() => [...eventLog].reverse(), [eventLog]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "auto auto 1fr",
        gap: 12,
        padding: 24,
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div style={{ ...surface, display: "grid", gap: 8 }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: STATUS_COLOR[status] ?? "#777",
            }}
          />
          <strong style={{ fontSize: 14 }}>Dev console</strong>
          <span style={{ fontSize: 12, color: "var(--color-text-muted, #8b8b8b)" }}>
            status: {status}
            {hostVersion ? ` · host ${hostVersion}` : ""}
            {protocolVersion !== undefined ? ` · proto ${protocolVersion}` : ""}
            {latencyMs !== undefined ? ` · ${latencyMs}ms` : ""}
          </span>
        </header>
        {initError ? (
          <p style={{ margin: 0, color: "#f85149", fontSize: 13 }}>{initError}</p>
        ) : null}
        {actionError ? (
          <p style={{ margin: 0, color: "#f85149", fontSize: 13 }}>{actionError}</p>
        ) : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={buttonStyle} onClick={handlePing}>
            Ping host
          </button>
          <button type="button" style={buttonStyle} onClick={clearEventLog}>
            Clear log
          </button>
        </div>
      </div>

      <div style={{ ...surface, display: "grid", gap: 8 }}>
        <strong style={{ fontSize: 13 }}>Project</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Absolute path to a project directory"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            style={inputStyle}
          />
          <button type="button" style={buttonStyle} onClick={handleOpenProject}>
            Open
          </button>
        </div>
        {activeProject ? (
          <span style={{ fontSize: 12, color: "var(--color-text-muted, #8b8b8b)" }}>
            active: {activeProject.displayName} ({activeProject.id})
          </span>
        ) : null}

        <strong style={{ fontSize: 13, marginTop: 4 }}>Session</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            style={buttonStyle}
            disabled={!activeProject}
            onClick={handleCreateSession}
          >
            Create session
          </button>
          <button
            type="button"
            style={buttonStyle}
            disabled={!activeSessionId}
            onClick={handleSendPrompt}
          >
            Send prompt
          </button>
          <button
            type="button"
            style={buttonStyle}
            disabled={!activeSessionId}
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
        <input
          type="text"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Prompt text"
          style={inputStyle}
        />
        {activeSessionId ? (
          <span style={{ fontSize: 12, color: "var(--color-text-muted, #8b8b8b)" }}>
            active session: {activeSessionId}
          </span>
        ) : null}
      </div>

      <div style={{ ...surface, overflow: "auto", padding: 0 }}>
        <header
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid var(--color-border, #2a2d33)",
            fontSize: 12,
            color: "var(--color-text-muted, #8b8b8b)",
          }}
        >
          Event log ({eventLog.length})
        </header>
        <pre
          style={{
            margin: 0,
            padding: 12,
            fontSize: 12,
            fontFamily: "var(--font-mono, monospace)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {reversedLog
            .map(
              (entry) =>
                `${new Date(entry.ts).toISOString()} ${entry.topic} ${JSON.stringify(entry.payload)}`,
            )
            .join("\n")}
        </pre>
      </div>
    </div>
  );
}
