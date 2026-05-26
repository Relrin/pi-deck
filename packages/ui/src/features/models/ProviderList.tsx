import type { ProviderSummary } from "@pi-deck/core/providers/types.js";
import { PidButton } from "../../components/buttons/PidButton";
import { ChevronRight, Plus } from "../../components/icons/index.js";
import { ProviderIcon } from "./icons";

interface ProviderListProps {
  providers: ProviderSummary[];
  selectedId: string | undefined;
  onSelect: (providerId: string) => void;
  onAddCustom: () => void;
}

const STATE_LABEL: Record<ProviderSummary["authState"], string> = {
  authenticated: "Authenticated",
  "needs-key": "Needs API key",
  unreachable: "Unreachable",
};

export function ProviderList({ providers, selectedId, onSelect, onAddCustom }: ProviderListProps) {
  const builtIns = providers.filter((p) => p.kind === "built-in");
  const customs = providers.filter((p) => p.kind === "custom-openai-compatible");

  return (
    <div className="pid-providers-col">
      <div className="pid-providers-col-section">Providers</div>
      {builtIns.map((p) => (
        <ProviderRow
          key={p.id}
          provider={p}
          active={p.id === selectedId}
          onSelect={() => onSelect(p.id)}
        />
      ))}
      {customs.length > 0 && <div className="pid-providers-col-section">Custom</div>}
      {customs.map((p) => (
        <ProviderRow
          key={p.id}
          provider={p}
          active={p.id === selectedId}
          onSelect={() => onSelect(p.id)}
        />
      ))}
      <div style={{ padding: "10px 12px" }}>
        <PidButton
          variant="ghost"
          icon={<Plus size={14} />}
          longLabel
          onClick={onAddCustom}
          aria-label="Add custom provider"
        >
          Add custom…
        </PidButton>
      </div>
    </div>
  );
}

function ProviderRow({
  provider,
  active,
  onSelect,
}: {
  provider: ProviderSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="pid-provider-row"
      data-active={active || undefined}
      onClick={onSelect}
      title={STATE_LABEL[provider.authState]}
    >
      <ProviderIcon iconKey={provider.iconKey} />
      <span className="pid-provider-row-name">{provider.name}</span>
      <span className="pid-provider-row-status" data-state={provider.authState} aria-hidden />
      {active && <ChevronRight size={12} />}
    </button>
  );
}
