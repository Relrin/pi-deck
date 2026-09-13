import type { ProviderSummary } from "@pi-deck/core/providers/types.js";
import { PidButton } from "../../components/buttons/PidButton";
import { ChevronRight, Plus } from "../../components/icons/index.js";
import { useI18nContext } from "../../i18n/i18n-react.js";
import type { TranslationFunctions } from "../../i18n/i18n-types.js";
import { ProviderIcon } from "./icons";

interface ProviderListProps {
  providers: ProviderSummary[];
  selectedId: string | undefined;
  onSelect: (providerId: string) => void;
  onAddCustom: () => void;
}

/**
 * Built per render from the catalog rather than held as a module constant: a module-level table
 * would capture whatever locale was loaded at import time and never update on a language switch.
 * Exported for `test/i18n/option-tables.test.ts`.
 */
export function providerStateLabels(
  t: TranslationFunctions,
): Record<ProviderSummary["authState"], string> {
  const copy = t.models.providers.state;
  return {
    authenticated: copy.authenticated(),
    "needs-key": copy.needsKey(),
    unreachable: copy.unreachable(),
  };
}

export function ProviderList({ providers, selectedId, onSelect, onAddCustom }: ProviderListProps) {
  const { LL } = useI18nContext();
  const builtIns = providers.filter((p) => p.kind === "built-in");
  const customs = providers.filter((p) => p.kind === "custom-openai-compatible");

  return (
    <div className="pid-providers-col">
      <div className="pid-providers-col-section">{LL.models.providers.heading()}</div>
      {builtIns.map((p) => (
        <ProviderRow
          key={p.id}
          provider={p}
          active={p.id === selectedId}
          onSelect={() => onSelect(p.id)}
        />
      ))}
      {customs.length > 0 && (
        <div className="pid-providers-col-section">{LL.models.providers.custom()}</div>
      )}
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
          aria-label={LL.models.providers.addCustomLabel()}
        >
          {LL.models.providers.addCustom()}
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
  const { LL } = useI18nContext();
  return (
    <button
      type="button"
      className="pid-provider-row"
      data-active={active || undefined}
      onClick={onSelect}
      title={providerStateLabels(LL)[provider.authState]}
    >
      <ProviderIcon iconKey={provider.iconKey} />
      <span className="pid-provider-row-name">{provider.name}</span>
      <span className="pid-provider-row-status" data-state={provider.authState} aria-hidden />
      {active && <ChevronRight size={12} />}
    </button>
  );
}
