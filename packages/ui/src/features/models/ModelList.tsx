import type { SessionModelRef } from "@pi-deck/core/domain/session.js";
import type { ModelInfo, ProviderSummary } from "@pi-deck/core/providers/types.js";
import { useMemo, useState } from "react";
import { PidChip } from "../../components/chip/PidChip";
import { Spinner } from "../../components/ui/Spinner";

interface ModelListProps {
  provider: ProviderSummary | undefined;
  models: ModelInfo[] | undefined;
  loading: boolean;
  activeModel: SessionModelRef | undefined;
  onAuthenticate: () => void;
  onSelectModel: (model: ModelInfo) => void;
}

/**
 * Compact context-window label: 200000 → "200K", 1_000_000 → "1M". Falls back to the raw
 * number for anything we don't fit cleanly.
 */
function formatContext(n: number | undefined): string | undefined {
  if (!n) return undefined;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function formatPrice(p: number | undefined): string | undefined {
  if (p === undefined) return undefined;
  if (p === 0) return undefined;
  return p >= 1 ? `$${p.toFixed(2)}` : `$${p.toFixed(3)}`;
}

export function ModelList({
  provider,
  models,
  loading,
  activeModel,
  onAuthenticate,
  onSelectModel,
}: ModelListProps) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!models) return undefined;
    if (!filter.trim()) return models;
    const needle = filter.trim().toLowerCase();
    return models.filter(
      (m) => m.id.toLowerCase().includes(needle) || m.label.toLowerCase().includes(needle),
    );
  }, [models, filter]);

  if (!provider) {
    return (
      <div className="pid-models-col">
        <div className="pid-models-empty">Select a provider to see models.</div>
      </div>
    );
  }

  // For built-in providers that aren't authenticated, prompt to add a key. Custom providers
  // typically work anonymously so we skip the gate even when getAuthState returned needs-key.
  if (provider.kind === "built-in" && provider.authState !== "authenticated") {
    return (
      <div className="pid-models-col">
        <div className="pid-models-empty">
          {provider.name} needs an API key.{"\n"}
          <button
            type="button"
            className="pid-btn"
            data-variant="primary"
            data-long-label
            style={{ marginTop: 12 }}
            onClick={onAuthenticate}
          >
            Add API key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pid-models-col">
      <div className="pid-models-toolbar">
        <input
          className="pid-models-filter"
          placeholder="Filter models"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="pid-models-list">
        {loading && !filtered ? (
          <div className="pid-models-empty">
            <Spinner /> Loading models…
          </div>
        ) : filtered && filtered.length > 0 ? (
          filtered.map((m) => {
            const active = activeModel?.providerId === m.providerId && activeModel.modelId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                className="pid-model-row"
                data-active={active || undefined}
                onClick={() => onSelectModel(m)}
              >
                <span className="pid-model-row-name">{m.label}</span>
                <span className="pid-model-row-id">{m.id}</span>
                <span className="pid-model-row-chips">
                  {formatContext(m.contextWindow) && (
                    <PidChip>{formatContext(m.contextWindow)} ctx</PidChip>
                  )}
                  {m.cost && formatPrice(m.cost.input) && (
                    <PidChip variant="info">
                      in {formatPrice(m.cost.input)} / out {formatPrice(m.cost.output)}
                    </PidChip>
                  )}
                  {m.supportsThinking && <PidChip variant="accent">thinking</PidChip>}
                </span>
              </button>
            );
          })
        ) : (
          <div className="pid-models-empty">{filter ? "No matches." : "No models found."}</div>
        )}
      </div>
    </div>
  );
}
