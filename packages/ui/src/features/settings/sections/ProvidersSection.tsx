import type { AgentLanguage } from "@pi-deck/core";
import { LOCALES } from "@pi-deck/core";
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
import { useI18nContext } from "../../../i18n/i18n-react";
import type { TranslationFunctions } from "../../../i18n/i18n-types";
import { LOCALE_META } from "../../../i18n/locale-meta";
import { rich, slot } from "../../../i18n/rich";
import { useLocaleStore } from "../../../i18n/useLocaleStore";
import { AddCustomProviderDialog } from "../../models/AddCustomProviderDialog.js";
import { AddProviderDialog } from "../../models/AddProviderDialog.js";
import { AuthenticateProviderDialog } from "../../models/AuthenticateProviderDialog.js";
import { ProviderAvatar } from "../../models/icons";
import { useProvidersStore } from "../../models/useProvidersStore.js";
import { pushAgentLanguageToAll } from "../../sessions/agent-language.js";
import { useSessionsStore } from "../../sessions/useSessionsStore.js";
import { useSessionDefaultsStore } from "../useSessionDefaultsStore.js";

// UI exposes the three effort levels the composer pickers support (low/medium/high); the
// wider ThinkingLevel enum (off/minimal/xhigh) isn't surfaced here. Built per render so a language
// switch reaches it - a module constant would freeze the launch locale.
export function effortOptions(t: TranslationFunctions): PidSegmentedPillOption<ThinkingLevel>[] {
  const level = t.settings.agents.effort.level;
  return [
    { value: "low", label: level.low() },
    { value: "medium", label: level.medium() },
    { value: "high", label: level.high() },
  ];
}

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

/**
 * "Match interface" first, then every shipped locale under its own name. Only the first option's
 * label is translated — the rest are endonyms, which never are.
 */
function agentLanguageOptions(matchUiLabel: string): PidSegmentedPillOption<AgentLanguage>[] {
  return [
    { value: "match-ui", label: matchUiLabel },
    ...LOCALES.map((value) => ({ value, label: LOCALE_META[value].nativeName })),
  ];
}

/**
 * The four agent modes. `value` is the `AgentMode` protocol value and never translates.
 *
 * The composer's own picker and the plan card's post-approval picker keep their own copies of this
 * vocabulary rather than sharing one: they word some entries differently, and collapsing them would
 * mean choosing one wording for all three surfaces. Revisit once the Russian catalog lands.
 */
export function agentModeOptions(t: TranslationFunctions): PidSegmentedPillOption<AgentMode>[] {
  const mode = t.settings.agents.mode;
  return [
    {
      value: "ask",
      label: mode.ask.label(),
      icon: <ShieldCheck size={13} />,
      description: mode.ask.description(),
    },
    {
      value: "accept-edits",
      label: mode.acceptEdits.label(),
      icon: <CheckCheck size={13} />,
      description: mode.acceptEdits.description(),
    },
    {
      value: "auto",
      label: mode.auto.label(),
      icon: <Sparkles size={13} />,
      description: mode.auto.description(),
    },
    {
      value: "plan",
      label: mode.plan.label(),
      icon: <MapIcon size={13} />,
      description: mode.plan.description(),
    },
  ];
}

/**
 * Settings → Providers. Lists built-in providers with auth status and "Set / replace API
 * key" buttons, plus custom providers with edit/remove. New custom providers are added via
 * the same dialog as the picker for consistency.
 */
export function ProvidersSection() {
  const { LL } = useI18nContext();
  const agentLanguage = useLocaleStore((s) => s.agentLanguage);
  const setAgentLanguage = useLocaleStore((s) => s.setAgentLanguage);

  const client = useSessionsStore((s) => s.client);
  const sessions = useSessionsStore((s) => s.sessions);
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

  const languageOptions = agentLanguageOptions(LL.settings.agents.responseLanguage.matchUi());

  return (
    <div className="pid-settings-panel-inner">
      <header>
        <div className="pid-settings-section-kicker">
          {LL.settings.kicker({ section: LL.settings.agents.kicker() })}
        </div>
        <h1 className="pid-settings-section-title">{LL.settings.agents.title()}</h1>
      </header>

      <DefaultBlock
        label={LL.settings.agents.responseLanguage.label()}
        desc={LL.settings.agents.responseLanguage.desc()}
      >
        <PidSegmentedPill
          ariaLabel={LL.settings.agents.responseLanguage.label()}
          value={agentLanguage}
          options={languageOptions}
          onChange={(next) => {
            setAgentLanguage(next);
            // The preference lives in the renderer but the agent runs host-side, so every open
            // session has to be told — this is the only path that changes the agent's language.
            if (client) void pushAgentLanguageToAll(client, sessions);
          }}
        />
      </DefaultBlock>

      <DefaultBlock
        label={LL.settings.agents.effort.label()}
        desc={LL.settings.agents.effort.desc()}
      >
        <PidSegmentedPill
          ariaLabel={LL.settings.agents.effort.ariaLabel()}
          value={defaultThinkingLevel}
          options={effortOptions(LL)}
          onChange={setDefaultThinkingLevel}
        />
      </DefaultBlock>

      <DefaultBlock label={LL.settings.agents.mode.label()} desc={LL.settings.agents.mode.desc()}>
        <PidSegmentedPill
          ariaLabel={LL.settings.agents.mode.ariaLabel()}
          value={defaultAgentMode}
          options={agentModeOptions(LL)}
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
            <div className="pid-settings-block-label">{LL.settings.agents.builtIn.label()}</div>
            <p className="pid-settings-block-desc">
              {/* The path is an identifier, so it stays in the component and is spliced in. */}
              {rich(LL.settings.agents.builtIn.desc({ path: slot("path") }), {
                path: <code>~/.pi/agent/auth.json</code>,
              })}
            </p>
          </div>
          <PidButton
            icon={<Plus size={12} />}
            longLabel
            style={HEADER_BTN}
            disabled={availableBuiltIns.length === 0}
            onClick={() => setAddProviderOpen(true)}
          >
            {LL.settings.agents.builtIn.add()}
          </PidButton>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {configuredBuiltIns.length === 0 ? (
            <div className="pid-list-empty">{LL.settings.agents.builtIn.empty()}</div>
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
            <div className="pid-settings-block-label">{LL.settings.agents.custom.label()}</div>
            <p className="pid-settings-block-desc">
              {rich(LL.settings.agents.custom.desc({ path: slot("path") }), {
                path: <code>~/.pi/agent/models.json</code>,
              })}
            </p>
          </div>
          <PidButton
            icon={<Plus size={12} />}
            longLabel
            style={HEADER_BTN}
            onClick={() => setAddOpen(true)}
          >
            {LL.settings.agents.custom.add()}
          </PidButton>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {customs.length === 0 ? (
            <div className="pid-list-empty">{LL.settings.agents.custom.empty()}</div>
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
  const { LL } = useI18nContext();
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
        {authenticated ? LL.settings.agents.row.authenticated() : LL.settings.agents.row.needsKey()}
      </PidChip>
      <PidButton variant="ghost" longLabel onClick={onAuthenticate}>
        {authenticated ? LL.settings.agents.row.replaceKey() : LL.settings.agents.row.addKey()}
      </PidButton>
      {authenticated && (
        <PidButton variant="ghost" longLabel onClick={onClear}>
          {LL.settings.agents.row.clear()}
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
  const { LL } = useI18nContext();
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
        {LL.settings.agents.row.setKey()}
      </PidButton>
      <PidButton variant="danger" longLabel onClick={onRemove}>
        {LL.common.remove()}
      </PidButton>
    </div>
  );
}
