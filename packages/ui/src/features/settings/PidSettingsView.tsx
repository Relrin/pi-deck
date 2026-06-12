import { type CSSProperties, type ReactNode, useEffect } from "react";
import { ArrowLeft } from "../../components/icons";
import { PidKbd } from "../../components/kbd/PidKbd";
import { NATIVE_OVERLAY_RESERVE_PX, reservesNativeOverlay } from "../../lib/platform";
import { AppearanceSection } from "./sections/AppearanceSection";
import { EditorSection } from "./sections/EditorSection";
import { GitGitHubSection } from "./sections/GitGitHubSection";
import { ProvidersSection } from "./sections/ProvidersSection";
import { SkillsSection } from "./sections/SkillsSection";
import {
  AdvancedSection,
  KeybindsSection,
  McpServersSection,
  PrivacySection,
} from "./sections/stubs";
import { TerminalSection } from "./sections/TerminalSection";
import { ToolsSection } from "./sections/ToolsSection";
import { type SettingsSectionId, useSettingsStore } from "./useSettingsStore";

interface NavItem {
  id: SettingsSectionId;
  label: string;
  stub: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "appearance", label: "Appearance", stub: false },
  { id: "agent-models", label: "Providers & Models", stub: false },
  { id: "tools", label: "Tools", stub: false },
  { id: "skills", label: "Skills", stub: false },
  { id: "git-github", label: "Git & GitHub", stub: false },
  { id: "mcp-servers", label: "MCP Servers", stub: true },
  { id: "editor", label: "Editor", stub: false },
  { id: "terminal", label: "Terminal", stub: false },
  { id: "keybinds", label: "Keybinds", stub: true },
  { id: "privacy", label: "Privacy", stub: true },
  { id: "advanced", label: "Advanced", stub: true },
];

const SECTION_RENDERERS: Record<SettingsSectionId, () => ReactNode> = {
  appearance: () => <AppearanceSection />,
  "agent-models": () => <ProvidersSection />,
  tools: () => <ToolsSection />,
  skills: () => <SkillsSection />,
  "git-github": () => <GitGitHubSection />,
  "mcp-servers": () => <McpServersSection />,
  editor: () => <EditorSection />,
  terminal: () => <TerminalSection />,
  keybinds: () => <KeybindsSection />,
  privacy: () => <PrivacySection />,
  advanced: () => <AdvancedSection />,
};

export function PidSettingsView() {
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

  // Win/Linux paint native min/max/close inside the topbar area; pad the right
  // cluster so the Esc hint doesn't get covered by the system controls.
  const rightStyle: CSSProperties | undefined = reservesNativeOverlay()
    ? { paddingRight: NATIVE_OVERLAY_RESERVE_PX }
    : undefined;

  return (
    <div className="pid-settings-root" role="dialog" aria-modal aria-label="Settings">
      <header className="pid-settings-header">
        <span className="pid-settings-header-actions">
          <button
            type="button"
            className="pid-settings-back-btn"
            aria-label="Close settings"
            title="Back (Esc)"
            onClick={() => setOpen(false)}
          >
            <ArrowLeft size={14} aria-hidden />
          </button>
          <span className="pid-settings-header-title">Settings</span>
        </span>
        <span className="pid-settings-header-hint" style={rightStyle}>
          <PidKbd keys={["Esc"]} /> to close
        </span>
      </header>
      <div className="pid-settings-grid">
        <nav className="pid-settings-nav" aria-label="Settings sections">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="pid-settings-nav-item"
              data-active={section === item.id || undefined}
              data-stub={item.stub || undefined}
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
