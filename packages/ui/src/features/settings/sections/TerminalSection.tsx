import type { TerminalShell } from "@pi-deck/core/protocol/commands.js";
import { useEffect, useState } from "react";
import { PidButton } from "../../../components/buttons/PidButton";
import { useSessionsStore } from "../../sessions/useSessionsStore";
import {
  type DefaultCwdMode,
  TERMINAL_FONT_SIZE_MAX,
  TERMINAL_FONT_SIZE_MIN,
  useTerminalSettingsStore,
} from "../../terminal/useTerminalSettingsStore";

const CWD_OPTIONS: Array<{ value: DefaultCwdMode; label: string }> = [
  { value: "session", label: "Session root" },
  { value: "last-used", label: "Last used" },
];

export function TerminalSection() {
  const client = useSessionsStore((s) => s.client);
  const shellPath = useTerminalSettingsStore((s) => s.shellPath);
  const setShellPath = useTerminalSettingsStore((s) => s.setShellPath);
  const fontFamily = useTerminalSettingsStore((s) => s.fontFamily);
  const setFontFamily = useTerminalSettingsStore((s) => s.setFontFamily);
  const fontSize = useTerminalSettingsStore((s) => s.fontSize);
  const setFontSize = useTerminalSettingsStore((s) => s.setFontSize);
  const defaultCwd = useTerminalSettingsStore((s) => s.defaultCwd);
  const setDefaultCwd = useTerminalSettingsStore((s) => s.setDefaultCwd);

  const [shells, setShells] = useState<TerminalShell[]>([]);
  const [defaultLabel, setDefaultLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    void client.terminal
      .detectShells()
      .then((res) => {
        if (cancelled) return;
        setShells(res.shells);
        const def = res.shells.find((s) => s.path === res.defaultPath);
        setDefaultLabel(def?.label ?? res.defaultPath);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client]);

  return (
    <div className="pid-settings-panel-inner">
      <header>
        <div className="pid-settings-section-kicker">Settings · Terminal</div>
        <h1 className="pid-settings-section-title">Terminal</h1>
      </header>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">Shell</div>
        <div className="pid-settings-block-desc">
          Shells detected on this system. Choosing one applies to terminals opened afterward.
        </div>
        <select
          className="pid-input"
          aria-label="Shell"
          value={shellPath ?? ""}
          onChange={(e) => setShellPath(e.target.value || null)}
        >
          <option value="">System default{defaultLabel ? ` (${defaultLabel})` : ""}</option>
          {shells.map((shell) => (
            <option key={shell.path} value={shell.path}>
              {shell.label} — {shell.path}
            </option>
          ))}
        </select>
      </section>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">Working directory</div>
        <div className="pid-settings-block-desc">
          New terminals open in the active session's root folder, inheriting its git branch.
        </div>
        <div className="pid-segmented" role="radiogroup" aria-label="Default working directory">
          {CWD_OPTIONS.map((option) => (
            <PidButton
              key={option.value}
              role="radio"
              aria-checked={defaultCwd === option.value}
              active={defaultCwd === option.value}
              onClick={() => setDefaultCwd(option.value)}
            >
              {option.label}
            </PidButton>
          ))}
        </div>
      </section>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">Font</div>
        <div className="pid-settings-block-desc">
          Leave the family blank to use the UI mono font (<code>--font-mono</code>).
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            className="pid-input"
            style={{ flex: "1 1 240px" }}
            type="text"
            aria-label="Font family"
            placeholder="Default (--font-mono)"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
          />
          <input
            className="pid-input"
            style={{ width: 90 }}
            type="number"
            aria-label="Font size"
            min={TERMINAL_FONT_SIZE_MIN}
            max={TERMINAL_FONT_SIZE_MAX}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
          />
        </div>
      </section>
    </div>
  );
}
