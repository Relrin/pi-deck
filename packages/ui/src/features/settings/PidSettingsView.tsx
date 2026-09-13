import { type ReactNode, useEffect } from "react";
import { ArrowLeft } from "../../components/icons";
import { PidKbd } from "../../components/kbd/PidKbd";
import { useI18nContext } from "../../i18n/i18n-react";
import type { TranslationFunctions } from "../../i18n/i18n-types";
import { rich, slot } from "../../i18n/rich";
import { WindowControls } from "../../layout/WindowControls";
import { usesCustomWindowControls } from "../../lib/platform";
import { AppearanceSection } from "./sections/AppearanceSection";
import { EditorSection } from "./sections/EditorSection";
import { GitGitHubSection } from "./sections/GitGitHubSection";
import { McpServersSection } from "./sections/McpServersSection";
import { ProvidersSection } from "./sections/ProvidersSection";
import { SkillsSection } from "./sections/SkillsSection";
import { TerminalSection } from "./sections/TerminalSection";
import { ToolsSection } from "./sections/ToolsSection";
import { type SettingsSectionId, useSettingsStore } from "./useSettingsStore";

interface NavItem {
  id: SettingsSectionId;
  label: string;
}

/**
 * Built per render from the catalog rather than held as a module constant: a module-level table
 * would capture whatever locale was loaded at import time and never update on a language switch.
 * `id` stays an identifier — only `label` is copy.
 *
 * Exported for `test/i18n/option-tables.test.ts`, which calls it with a sentinel translations
 * object so a label that comes back as a literal fails there.
 */
export function navItems(t: TranslationFunctions): readonly NavItem[] {
  return [
    { id: "appearance", label: t.settings.nav.appearance() },
    { id: "agent-models", label: t.settings.nav.agentModels() },
    { id: "tools", label: t.settings.nav.tools() },
    { id: "skills", label: t.settings.nav.skills() },
    { id: "mcp-servers", label: t.settings.nav.mcpServers() },
    { id: "editor", label: t.settings.nav.editor() },
    { id: "git-github", label: t.settings.nav.gitGithub() },
    { id: "terminal", label: t.settings.nav.terminal() },
  ];
}

const SECTION_RENDERERS: Record<SettingsSectionId, () => ReactNode> = {
  appearance: () => <AppearanceSection />,
  "agent-models": () => <ProvidersSection />,
  tools: () => <ToolsSection />,
  skills: () => <SkillsSection />,
  "git-github": () => <GitGitHubSection />,
  "mcp-servers": () => <McpServersSection />,
  editor: () => <EditorSection />,
  terminal: () => <TerminalSection />,
};

export function PidSettingsView() {
  const { LL } = useI18nContext();
  const open = useSettingsStore((s) => s.open);
  const section = useSettingsStore((s) => s.section);
  const setOpen = useSettingsStore((s) => s.setOpen);
  const setSection = useSettingsStore((s) => s.setSection);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  if (!open) return null;

  // The overlay covers the whole window (including the app topbar), so on Win/Linux it has
  // to carry its own window controls — otherwise there'd be no min/max/close while settings
  // is open.
  const showWindowControls = usesCustomWindowControls();

  return (
    <div className="pid-settings-root" role="dialog" aria-modal aria-label={LL.settings.title()}>
      <header
        className="pid-settings-header"
        data-window-controls={showWindowControls || undefined}
      >
        <span className="pid-settings-header-actions">
          <button
            type="button"
            className="pid-settings-back-btn"
            aria-label={LL.settings.close()}
            title={LL.settings.back()}
            onClick={() => setOpen(false)}
          >
            <ArrowLeft size={14} aria-hidden />
          </button>
          <span className="pid-settings-header-title">{LL.settings.title()}</span>
        </span>
        <span className="pid-settings-header-right">
          <span className="pid-settings-header-hint">
            {rich(LL.settings.escHint({ esc: slot("esc") }), { esc: <PidKbd keys={["Esc"]} /> })}
          </span>
          {showWindowControls && <WindowControls />}
        </span>
      </header>
      <div className="pid-settings-grid">
        <nav className="pid-settings-nav" aria-label={LL.settings.navLabel()}>
          {navItems(LL).map((item) => (
            <button
              key={item.id}
              type="button"
              className="pid-settings-nav-item"
              data-active={section === item.id || undefined}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="pid-settings-panel">{SECTION_RENDERERS[section]()}</div>
      </div>
    </div>
  );
}
