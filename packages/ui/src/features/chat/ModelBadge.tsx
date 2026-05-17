import type { SessionModelRef, ThinkingLevel } from "@pi-deck/core/domain/session.js";
import type { ProviderSummary } from "@pi-deck/core/providers/types.js";
import { ProviderIcon } from "../models/icons";

interface ModelBadgeProps {
  modelRef: SessionModelRef | undefined;
  provider: ProviderSummary | undefined;
  modelLabel: string | undefined;
  thinkingLevel: ThinkingLevel | undefined;
  onOpenPicker: () => void;
}

export function ModelBadge({
  modelRef,
  provider,
  modelLabel,
  thinkingLevel,
  onOpenPicker,
}: ModelBadgeProps) {
  if (!modelRef) {
    return (
      <button type="button" className="pid-model-badge" data-empty="true" onClick={onOpenPicker}>
        select model
      </button>
    );
  }
  return (
    <button type="button" className="pid-model-badge" onClick={onOpenPicker}>
      <ProviderIcon iconKey={provider?.iconKey ?? "custom"} size={12} />
      <span>{provider?.name ?? modelRef.providerId}</span>
      <span className="pid-model-badge-sep">·</span>
      <span className="pid-model-badge-name">{modelLabel ?? modelRef.modelId}</span>
      {thinkingLevel && thinkingLevel !== "off" && (
        <>
          <span className="pid-model-badge-sep">·</span>
          <span>{thinkingLevel}</span>
        </>
      )}
    </button>
  );
}
