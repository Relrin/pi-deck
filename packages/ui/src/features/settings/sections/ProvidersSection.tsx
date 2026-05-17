import type { ProviderSummary } from "@pi-deck/core/providers/types.js";
import { useEffect, useState } from "react";
import { PidButton } from "../../../components/buttons/PidButton";
import { PidChip } from "../../../components/chip/PidChip";
import { AddCustomProviderDialog } from "../../models/AddCustomProviderDialog.js";
import { AuthenticateProviderDialog } from "../../models/AuthenticateProviderDialog.js";
import { ProviderAvatar } from "../../models/icons";
import { useProvidersStore } from "../../models/useProvidersStore.js";

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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const builtIns = providers.filter((p) => p.kind === "built-in");
  const customs = providers.filter((p) => p.kind === "custom-openai-compatible");

  return (
    <div className="pid-settings-panel-inner">
      <header>
        <div className="pid-settings-section-kicker">Settings · Providers</div>
        <h1 className="pid-settings-section-title">Providers & Models</h1>
      </header>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">Built-in providers</div>
        <p className="pid-settings-block-desc">
          Set an API key to enable models from this provider. Keys are stored in pi's{" "}
          <code>~/.pi/agent/auth.json</code> (0600 perms) and never sent to the renderer.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {builtIns.map((p) => (
            <ProviderRow
              key={p.id}
              provider={p}
              onAuthenticate={() => setAuth(p)}
              onClear={() => clearApiKey(p.authJsonKey)}
            />
          ))}
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
          <div>
            <div className="pid-settings-block-label">Custom providers</div>
            <p className="pid-settings-block-desc">
              OpenAI-compatible endpoints (LM Studio, Ollama, vLLM, self-hosted gateways). pi-deck
              writes these to <code>~/.pi/agent/models.json</code>.
            </p>
          </div>
          <PidButton glyph="plus" longLabel onClick={() => setAddOpen(true)}>
            Add custom
          </PidButton>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {customs.length === 0 ? (
            <div className="pid-overview-empty">No custom providers yet.</div>
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
