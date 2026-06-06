import { useMemo, useState } from "react";
import { PidButton } from "../../../components/buttons/PidButton";
import { PidSelect } from "../../../components/inputs/PidSelect";
import { PidStepper } from "../../../components/inputs/PidStepper";
import { CUSTOM_FONT_VALUE, detectAvailableMonoFonts } from "../../terminal/terminalFonts";
import { useDetectedShells } from "../../terminal/useDetectedShells";
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
  const shellPath = useTerminalSettingsStore((s) => s.shellPath);
  const setShellPath = useTerminalSettingsStore((s) => s.setShellPath);
  const fontFamily = useTerminalSettingsStore((s) => s.fontFamily);
  const setFontFamily = useTerminalSettingsStore((s) => s.setFontFamily);
  const fontSize = useTerminalSettingsStore((s) => s.fontSize);
  const setFontSize = useTerminalSettingsStore((s) => s.setFontSize);
  const defaultCwd = useTerminalSettingsStore((s) => s.defaultCwd);
  const setDefaultCwd = useTerminalSettingsStore((s) => s.setDefaultCwd);

  const { shells, defaultPath } = useDetectedShells();
  const defaultLabel = shells.find((s) => s.path === defaultPath)?.label ?? defaultPath;
  const selectableShells = shells.filter((s) => s.kind !== "wsl");

  // Installed subset of the curated monospace families — probed once on mount.
  const availableFonts = useMemo(() => detectAvailableMonoFonts(), []);
  const [customMode, setCustomMode] = useState(false);
  // Show the free-text field when the user explicitly chose "Custom…", or when the stored family
  // isn't one we can offer as an option (a typed value, or a font that isn't installed here).
  const showCustomFont = customMode || (fontFamily !== "" && !availableFonts.includes(fontFamily));
  const fontSelectValue = showCustomFont ? CUSTOM_FONT_VALUE : fontFamily;

  function handleSelectFont(value: string) {
    if (value === CUSTOM_FONT_VALUE) {
      setCustomMode(true);
      return;
    }
    setCustomMode(false);
    setFontFamily(value);
  }

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
        <PidSelect
          aria-label="Shell"
          value={shellPath ?? ""}
          onChange={(e) => setShellPath(e.target.value || null)}
        >
          <option value="">System default{defaultLabel ? ` (${defaultLabel})` : ""}</option>
          {selectableShells.map((shell) => (
            <option key={shell.path} value={shell.path}>
              {shell.label} — {shell.path}
            </option>
          ))}
        </PidSelect>
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
          Pick an installed monospace family, or choose <code>Custom…</code> to type your own. The
          default follows the UI mono font (<code>--font-mono</code>).
        </div>
        <div className="pid-terminal-font-row">
          <PidSelect
            aria-label="Font family"
            wrapperClassName="pid-terminal-font-family"
            value={fontSelectValue}
            onChange={(e) => handleSelectFont(e.target.value)}
          >
            <option value="">Default (--font-mono)</option>
            {availableFonts.map((family) => (
              <option key={family} value={family} style={{ fontFamily: `"${family}", monospace` }}>
                {family}
              </option>
            ))}
            <option value={CUSTOM_FONT_VALUE}>Custom…</option>
          </PidSelect>
          <PidStepper
            value={fontSize}
            min={TERMINAL_FONT_SIZE_MIN}
            max={TERMINAL_FONT_SIZE_MAX}
            onChange={setFontSize}
            ariaLabel="font size"
          />
        </div>
        {showCustomFont && (
          <input
            className="pid-input pid-terminal-font-custom"
            type="text"
            aria-label="Custom font family"
            placeholder="e.g. Fira Code, monospace"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
          />
        )}
      </section>
    </div>
  );
}
