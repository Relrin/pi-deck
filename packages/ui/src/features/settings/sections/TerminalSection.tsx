import { useMemo, useState } from "react";
import { PidButton } from "../../../components/buttons/PidButton";
import { PidSelect } from "../../../components/inputs/PidSelect";
import { PidStepper } from "../../../components/inputs/PidStepper";
import { useI18nContext } from "../../../i18n/i18n-react";
import type { TranslationFunctions } from "../../../i18n/i18n-types";
import { rich, slot } from "../../../i18n/rich";
import { CUSTOM_FONT_VALUE, detectAvailableMonoFonts } from "../../terminal/terminalFonts";
import { useDetectedShells } from "../../terminal/useDetectedShells";
import {
  type DefaultCwdMode,
  TERMINAL_FONT_SIZE_MAX,
  TERMINAL_FONT_SIZE_MIN,
  useTerminalSettingsStore,
} from "../../terminal/useTerminalSettingsStore";

/** Built per render — a module constant would freeze the launch locale. `value` is an identifier. */
export function cwdOptions(
  t: TranslationFunctions,
): Array<{ value: DefaultCwdMode; label: string }> {
  return [
    { value: "session", label: t.settings.terminal.cwd.session() },
    { value: "last-used", label: t.settings.terminal.cwd.lastUsed() },
  ];
}

export function TerminalSection() {
  const { LL } = useI18nContext();
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
        <div className="pid-settings-section-kicker">
          {LL.settings.kicker({ section: LL.settings.terminal.kicker() })}
        </div>
        <h1 className="pid-settings-section-title">{LL.settings.terminal.title()}</h1>
      </header>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">{LL.settings.terminal.shell.label()}</div>
        <div className="pid-settings-block-desc">{LL.settings.terminal.shell.desc()}</div>
        <PidSelect
          aria-label={LL.settings.terminal.shell.ariaLabel()}
          value={shellPath ?? ""}
          onChange={(e) => setShellPath(e.target.value || null)}
        >
          <option value="">
            {defaultLabel
              ? LL.settings.terminal.shell.systemDefaultNamed({ name: defaultLabel })
              : LL.settings.terminal.shell.systemDefault()}
          </option>
          {selectableShells.map((shell) => (
            <option key={shell.path} value={shell.path}>
              {LL.settings.terminal.shell.option({ label: shell.label, path: shell.path })}
            </option>
          ))}
        </PidSelect>
      </section>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">{LL.settings.terminal.cwd.label()}</div>
        <div className="pid-settings-block-desc">{LL.settings.terminal.cwd.desc()}</div>
        <div
          className="pid-segmented"
          role="radiogroup"
          aria-label={LL.settings.terminal.cwd.ariaLabel()}
        >
          {cwdOptions(LL).map((option) => (
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
        <div className="pid-settings-block-label">{LL.settings.terminal.font.label()}</div>
        <div className="pid-settings-block-desc">
          {rich(LL.settings.terminal.font.desc({ custom: slot("custom"), mono: slot("mono") }), {
            custom: <code>{LL.settings.terminal.font.custom()}</code>,
            mono: <code>{LL.settings.terminal.font.monoVar()}</code>,
          })}
        </div>
        <div className="pid-terminal-font-row">
          <PidSelect
            aria-label={LL.settings.terminal.font.familyAriaLabel()}
            wrapperClassName="pid-terminal-font-family"
            value={fontSelectValue}
            onChange={(e) => handleSelectFont(e.target.value)}
          >
            <option value="">{LL.settings.terminal.font.defaultOption()}</option>
            {availableFonts.map((family) => (
              <option key={family} value={family} style={{ fontFamily: `"${family}", monospace` }}>
                {family}
              </option>
            ))}
            <option value={CUSTOM_FONT_VALUE}>{LL.settings.terminal.font.custom()}</option>
          </PidSelect>
          <PidStepper
            value={fontSize}
            min={TERMINAL_FONT_SIZE_MIN}
            max={TERMINAL_FONT_SIZE_MAX}
            onChange={setFontSize}
            ariaLabel={LL.settings.terminal.font.sizeLabel()}
          />
        </div>
        {showCustomFont && (
          <input
            className="pid-input pid-terminal-font-custom"
            type="text"
            aria-label={LL.settings.terminal.font.customAriaLabel()}
            placeholder={LL.settings.terminal.font.customPlaceholder()}
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
          />
        )}
      </section>
    </div>
  );
}
