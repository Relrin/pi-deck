import type { SessionModelRef } from "@pi-deck/core/domain/session.js";
import type { ModelInfo } from "@pi-deck/core/providers/types.js";
import { useEffect, useMemo } from "react";
import { PidChipPicker, type PidChipPickerOption } from "../../components/picker/PidChipPicker.js";
import { useProvidersStore } from "../models/useProvidersStore.js";
import { useIntroComposerStore } from "./useIntroComposerStore.js";

function refKey(ref: SessionModelRef): string {
  return `${ref.providerId}/${ref.modelId}`;
}

function parseRefKey(key: string): SessionModelRef | undefined {
  const slash = key.indexOf("/");
  if (slash <= 0 || slash === key.length - 1) return undefined;
  return { providerId: key.slice(0, slash), modelId: key.slice(slash + 1) };
}

export function PidModelPicker() {
  const providers = useProvidersStore((s) => s.providers);
  const modelsByProvider = useProvidersStore((s) => s.modelsByProvider);
  const defaultModel = useProvidersStore((s) => s.defaultModel);
  const refreshModels = useProvidersStore((s) => s.refreshModels);

  const pendingModelRef = useIntroComposerStore((s) => s.pendingModelRef);
  const setPendingModel = useIntroComposerStore((s) => s.setPendingModel);

  // Lazy-load models for each authenticated provider once. Built-in providers that
  // require a key but don't have one yet are skipped — listing their models would
  // surface options the user can't actually run.
  useEffect(() => {
    for (const provider of providers) {
      if (provider.authState !== "authenticated") continue;
      if (modelsByProvider[provider.id]) continue;
      void refreshModels(provider.id);
    }
  }, [providers, modelsByProvider, refreshModels]);

  const flatModels = useMemo<Array<ModelInfo & { providerName: string }>>(() => {
    const out: Array<ModelInfo & { providerName: string }> = [];
    for (const provider of providers) {
      const models = modelsByProvider[provider.id];
      if (!models) continue;
      for (const m of models) out.push({ ...m, providerName: provider.name });
    }
    return out;
  }, [providers, modelsByProvider]);

  const activeRef = pendingModelRef ?? defaultModel;
  const activeKey = activeRef ? refKey(activeRef) : "";
  const activeLabel = useMemo(() => {
    if (!activeRef) return "model";
    const found = flatModels.find(
      (m) => m.providerId === activeRef.providerId && m.id === activeRef.modelId,
    );
    return found?.label ?? activeRef.modelId;
  }, [activeRef, flatModels]);

  const options: PidChipPickerOption[] = useMemo(() => {
    if (flatModels.length === 0) {
      // Fall back to showing whatever ref we have so the chip isn't empty before models load.
      return activeRef
        ? [{ value: activeKey, label: activeRef.modelId, sub: activeRef.providerId }]
        : [];
    }
    return flatModels.map((m) => ({
      value: refKey({ providerId: m.providerId, modelId: m.id }),
      label: m.label,
      sub: m.providerName,
    }));
  }, [flatModels, activeRef, activeKey]);

  const onChange = (key: string) => {
    const ref = parseRefKey(key);
    if (ref) setPendingModel(ref);
  };

  return (
    <PidChipPicker
      icon="sparkle"
      ariaLabel="Select model"
      value={activeKey}
      options={options}
      onChange={onChange}
      triggerLabel={activeLabel}
      disabled={options.length === 0}
      minPopoverWidth={300}
    />
  );
}
