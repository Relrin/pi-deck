import type { AgentMode, ThinkingLevel } from "@pi-deck/core/domain/session.js";
import type { ProviderSummary } from "@pi-deck/core/providers/types.js";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { PidButton } from "../../../components/buttons/PidButton";
import { PidChip } from "../../../components/chip/PidChip";
import {
  CheckCheck,
  Map as MapIcon,
  Plus,
  ShieldCheck,
  Sparkles,
} from "../../../components/icons/index.js";
import {
  PidSegmentedPill,
  type PidSegmentedPillOption,
} from "../../../components/segmented/PidSegmentedPill.js";
import { AddCustomProviderDialog } from "../../models/AddCustomProviderDialog.js";
import { AddProviderDialog } from "../../models/AddProviderDialog.js";
import { AuthenticateProviderDialog } from "../../models/AuthenticateProviderDialog.js";
import { ProviderAvatar } from "../../models/icons";
import { useProvidersStore } from "../../models/useProvidersStore.js";
import { useSessionDefaultsStore } from "../useSessionDefaultsStore.js";

// UI exposes the three effort levels the composer pickers support (low/medium/high); the
// wider ThinkingLevel enum (off/minimal/xhigh) isn't surfaced here.
const EFFORT_OPTIONS: PidSegmentedPillOption<ThinkingLevel>[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

// Compact header-action button — matches the "Install server" button in McpServersSection.
// flexShrink/nowrap keep the label on one line even when the section description shares the row.
const HEADER_BTN = {
  height: 28,
  paddingTop: 0,
  paddingBottom: 0,
  boxSizing: "border-box",
  lineHeight: 1,
  flexShrink: 0,
  whiteSpace: "nowrap",
} as const;

const AGENT_MODE_OPTIONS: PidSegmentedPillOption<AgentMode>[] = [
  {
    value: "ask",
    label: "Ask",
    icon: <ShieldCheck size={13} />,
    description: "Confirm before each write or shell command.",
  },
  {
    value: "accept-edits",
    label: "Accept edits",
    icon: <CheckCheck size={13} />,
    description: "Auto-accept edits to listed files & paths.",
  },
  {
    value: "auto",
    label: "Auto",
    icon: <Sparkles size={13} />,
    description: "Auto-run; risky actions pause for approval.",
  },
  {
    value: "plan",
    label: "Plan",
    icon: <MapIcon size={13} />,
    description: "Plan-only - no writes, no commands.",
  },
];

/**
 * Settings → Providers. Lists built-in providers with auth status and "Set / replace API
 * key" buttons, plus custom providers with edit/remove. New custom providers are added via
 * the same dialog as the picker for consistency.
 */
export function ProvidersSection() {
  const providers = useProvidersStore((s) => s.providers);
  const refresh = useProvidersStore((s) => s.refreshProviders);
  const clearApiKey = useProvidersStore((s) => s.clearApiKey);
  const removeCustom = useProvidersStore((s) => s.removeCustomProvider);
  const [auth, setAuth] = useState<ProviderSummary | undefined>(undefined);
  const [addOpen, setAddOpen] = useState(false);
  const [addProviderOpen, setAddProviderOpen] = useState(false);

  const defaultThinkingLevel = useSessionDefaultsStore((s) => s.defaultThinkingLevel);
  const setDefaultThinkingLevel = useSessionDefaultsStore((s) => s.setDefaultThinkingLevel);
  const defaultAgentMode = useSessionDefaultsStore((s) => s.defaultAgentMode);
  const setDefaultAgentMode = useSessionDefaultsStore((s) => s.setDefaultAgentMode);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const builtIns = providers.filter((p) => p.kind === "built-in");
  // A built-in is "configured" once it has a key (set in-app or via env var). Only those get a
  // row; the rest live behind the "Add provider" selector so the page stays scannable.
  const configuredBuiltIns = builtIns.filter((p) => p.authState === "authenticated");
  const availableBuiltIns = builtIns.filter((p) => p.authState !== "authenticated");
  const customs = providers.filter((p) => p.kind === "custom-openai-compatible");

  return (
    <div className="pid-settings-panel-inner">
      <header>
        <div className="pid-settings-section-kicker">Settings · Agents</div>
        <h1 className="pid-settings-section-title">Agents & Models</h1>
      </header>

      <DefaultBlock
        label="Default effort"
        desc="How deeply agent thinks. Higher effort means more thorought responses at cost of longer processing time and consuming more tokens. Applies to new conversations."
      >
        <PidSegmentedPill
          ariaLabel="Default thinking effort"
          value={defaultThinkingLevel}
          options={EFFORT_OPTIONS}
          onChange={setDefaultThinkingLevel}
        />
      </DefaultBlock>

      <DefaultBlock
        label="Default agent mode"
        desc="How the agent handles writes & shell commands in new conversations."
      >
        <PidSegmentedPill
          ariaLabel="Default agent mode"
          value={defaultAgentMode}
          options={AGENT_MODE_OPTIONS}
          onChange={setDefaultAgentMode}
        />
      </DefaultBlock>

      <section className="pid-settings-block">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pid-settings-block-label">Built-in providers</div>
            <p className="pid-settings-block-desc">
              Add an API key to enable a provider's models. Keys are stored in pi's{" "}
              <code>~/.pi/agent/auth.json</code> (0600 perms) and never sent to the renderer.
            </p>
          </div>
          <PidButton
            icon={<Plus size={12} />}
            longLabel
            style={HEADER_BTN}
            disabled={availableBuiltIns.length === 0}
            onClick={() => setAddProviderOpen(true)}
          >
            Add provider
          </PidButton>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {configuredBuiltIns.length === 0 ? (
            <div className="pid-list-empty">
              No providers configured yet. Use “Add provider” to enable one with an API key.
            </div>
          ) : (
            configuredBuiltIns.map((p) => (
              <ProviderRow
                key={p.id}
                provider={p}
                onAuthenticate={() => setAuth(p)}
                onClear={() => clearApiKey(p.authJsonKey)}
              />
            ))
          )}
        </div>
      </section>

      <section className="pid-settings-block">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pid-settings-block-label">Custom providers</div>
            <p className="pid-settings-block-desc">
              OpenAI-compatible endpoints (LM Studio, Ollama, vLLM, self-hosted gateways). pi-deck
              writes these to <code>~/.pi/agent/models.json</code>.
            </p>
          </div>
          <PidButton
            icon={<Plus size={12} />}
            longLabel
            style={HEADER_BTN}
            onClick={() => setAddOpen(true)}
          >
            Add custom
          </PidButton>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {customs.length === 0 ? (
            <div className="pid-list-empty">No custom providers yet.</div>
          ) : (
            customs.map((p) => (
              <CustomProviderRow
                key={p.id}
                provider={p}
                onAuthenticate={() => setAuth(p)}
                onRemove={() => removeCustom(p.id)}
              />
            ))
          )}
        </div>
      </section>

      <AddProviderDialog
        open={addProviderOpen}
        onOpenChange={setAddProviderOpen}
        providers={availableBuiltIns}
        onSelect={(p) => {
          setAddProviderOpen(false);
          setAuth(p);
        }}
      />
      <AuthenticateProviderDialog
        provider={auth}
        open={Boolean(auth)}
        onOpenChange={(next) => {
          if (!next) setAuth(undefined);
        }}
      />
      <AddCustomProviderDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function DefaultBlock({
  label,
  desc,
  children,
}: {
  label: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <section className="pid-settings-block">
      <div className="pid-settings-block-label">{label}</div>
      <p className="pid-settings-block-desc">{desc}</p>
      {children}
    </section>
  );
}

function ProviderRow({
  provider,
  onAuthenticate,
  onClear,
}: {
  provider: ProviderSummary;
  onAuthenticate: () => void;
  onClear: () => void;
}) {
  const authenticated = provider.authState === "authenticated";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        background: "var(--bg-1)",
      }}
    >
      <ProviderAvatar iconKey={provider.iconKey} size={18} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "var(--ink-0)", fontSize: "var(--t-13)" }}>{provider.name}</div>
        <div
          style={{
            color: "var(--ink-3)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {provider.envVar ?? provider.authJsonKey}
        </div>
      </div>
      <PidChip variant={authenticated ? "add" : "info"}>
        {authenticated ? "Authenticated" : "Needs key"}
      </PidChip>
      <PidButton variant="ghost" longLabel onClick={onAuthenticate}>
        {authenticated ? "Replace key" : "Add key"}
      </PidButton>
      {authenticated && (
        <PidButton variant="ghost" longLabel onClick={onClear}>
          Clear
        </PidButton>
      )}
    </div>
  );
}

function CustomProviderRow({
  provider,
  onAuthenticate,
  onRemove,
}: {
  provider: ProviderSummary;
  onAuthenticate: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        background: "var(--bg-1)",
      }}
    >
      <ProviderAvatar iconKey={provider.iconKey} size={18} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "var(--ink-0)", fontSize: "var(--t-13)" }}>{provider.name}</div>
        <div
          style={{
            color: "var(--ink-3)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.04em",
          }}
        >
          {provider.baseUrl} · {provider.api}
        </div>
      </div>
      <PidButton variant="ghost" longLabel onClick={onAuthenticate}>
        Set key
      </PidButton>
      <PidButton variant="danger" longLabel onClick={onRemove}>
        Remove
      </PidButton>
    </div>
  );
}
