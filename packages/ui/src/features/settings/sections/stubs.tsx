import type { ReactNode } from "react";
import { MockDataBanner } from "../MockDataBanner";

interface StubProps {
  title: string;
  kicker: string;
  plan: string;
  description: ReactNode;
}

function StubSection({ title, kicker, plan, description }: StubProps) {
  return (
    <div className="pid-settings-panel-inner">
      <header>
        <div className="pid-settings-section-kicker">{kicker}</div>
        <h1 className="pid-settings-section-title">{title}</h1>
      </header>
      <div className="pid-section-stub">
        <MockDataBanner />
        <p>{description}</p>
        <p>
          Lands in <strong>{plan}</strong>.
        </p>
      </div>
    </div>
  );
}

export function McpServersSection() {
  return (
    <StubSection
      title="MCP Servers"
      kicker="Settings · MCP Servers"
      plan="plan 011"
      description="Register Model Context Protocol servers, scope their tools, and review their permissions."
    />
  );
}

export function EditorSection() {
  return (
    <StubSection
      title="Editor"
      kicker="Settings · Editor"
      plan="a later plan"
      description="Tab width, line endings, code-fence rendering, and other editor-level preferences."
    />
  );
}

export function KeybindsSection() {
  return (
    <StubSection
      title="Keybinds"
      kicker="Settings · Keybinds"
      plan="a later plan"
      description="Customise global shortcuts and per-feature bindings. Conflicts will be detected and surfaced inline."
    />
  );
}

export function PrivacySection() {
  return (
    <StubSection
      title="Privacy"
      kicker="Settings · Privacy"
      plan="a later plan"
      description="Telemetry, transcript retention, and what pi-deck is allowed to send upstream."
    />
  );
}

export function AdvancedSection() {
  return (
    <StubSection
      title="Advanced"
      kicker="Settings · Advanced"
      plan="a later plan"
      description="Diagnostic toggles, experimental features, and direct access to the on-disk theme / config directory."
    />
  );
}
