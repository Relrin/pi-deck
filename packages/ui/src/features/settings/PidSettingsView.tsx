import { type ReactNode, useEffect } from "react";
import { PidIconButton } from "../../components/buttons/PidIconButton";
import { PidKbd } from "../../components/kbd/PidKbd";
import { AppearanceSection } from "./sections/AppearanceSection";
import { ProvidersSection } from "./sections/ProvidersSection";
import {
  AdvancedSection,
  EditorSection,
  GitGitHubSection,
  KeybindsSection,
  McpServersSection,
  PrivacySection,
} from "./sections/stubs";
import { type SettingsSectionId, useSettingsStore } from "./useSettingsStore";

interface NavItem {
  id: SettingsSectionId;
  label: string;
  stub: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "appearance", label: "Appearance", stub: false },
  { id: "agent-models", label: "Providers & Models", stub: false },
  { id: "git-github", label: "Git & GitHub", stub: true },
  { id: "mcp-servers", label: "MCP Servers", stub: true },
  { id: "editor", label: "Editor", stub: true },
  { id: "keybinds", label: "Keybinds", stub: true },
  { id: "privacy", label: "Privacy", stub: true },
  { id: "advanced", label: "Advanced", stub: true },
];

const SECTION_RENDERERS: Record<SettingsSectionId, () => ReactNode> = {
  appearance: () => <AppearanceSection />,
  "agent-models": () => <ProvidersSection />,
  "git-github": () => <GitGitHubSection />,
  "mcp-servers": () => <McpServersSection />,
  editor: () => <EditorSection />,
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

  return (
    <div className="pid-settings-root" role="dialog" aria-modal aria-label="Settings">
      <header className="pid-settings-header">
        <span className="pid-settings-header-title">Settings</span>
        <span className="pid-settings-header-hint">
          <PidKbd keys={["Esc"]} /> to close
          <PidIconButton kind="close" label="Close settings" onClick={() => setOpen(false)} />
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
