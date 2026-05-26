import type { ThinkingLevel } from "@pi-deck/core/domain/session.js";
import { useMemo } from "react";
import { PidChipPicker, type PidChipPickerOption } from "../../components/picker/PidChipPicker.js";
import { useProvidersStore } from "../models/useProvidersStore.js";
import { useIntroComposerStore } from "./useIntroComposerStore.js";

interface EffortLevel {
  value: ThinkingLevel;
  label: string;
}

const LEVELS: EffortLevel[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const DEFAULT_LEVEL: ThinkingLevel = "medium";

export function PidEffortPicker() {
  const providers = useProvidersStore((s) => s.providers);
  const modelsByProvider = useProvidersStore((s) => s.modelsByProvider);
  const defaultModel = useProvidersStore((s) => s.defaultModel);

  const pendingModelRef = useIntroComposerStore((s) => s.pendingModelRef);
  const pendingThinkingLevel = useIntroComposerStore((s) => s.pendingThinkingLevel);
  const setPendingThinkingLevel = useIntroComposerStore((s) => s.setPendingThinkingLevel);

  const activeRef = pendingModelRef ?? defaultModel;
  const activeModel = useMemo(() => {
    if (!activeRef) return undefined;
    return modelsByProvider[activeRef.providerId]?.find((m) => m.id === activeRef.modelId);
  }, [activeRef, modelsByProvider]);

  // Pre-models-load (or for models we don't know about yet) we optimistically allow all
  // three levels rather than greying out the chip — backend will reject if unsupported.
  const allowedLevels = useMemo<Set<ThinkingLevel>>(() => {
    if (!activeModel) return new Set(LEVELS.map((l) => l.value));
    if (!activeModel.supportsThinking) return new Set();
    const supplied = new Set(activeModel.thinkingLevels ?? []);
    return new Set(LEVELS.filter((l) => supplied.has(l.value)).map((l) => l.value));
  }, [activeModel]);

  // Hide the chip entirely when the resolved model is known and explicitly doesn't think —
  // consistent with how ThinkingLevelPicker.tsx behaves inside chat sessions.
  if (activeModel && !activeModel.supportsThinking) return null;
  // Force the suppression of unused-providers warning while still subscribing for re-renders.
  void providers;

  const activeValue = pendingThinkingLevel ?? DEFAULT_LEVEL;
  const options: PidChipPickerOption[] = LEVELS.map((l) => ({
    value: l.value,
    label: l.label,
    disabled: !allowedLevels.has(l.value),
  }));

  const activeLabel = LEVELS.find((l) => l.value === activeValue)?.label ?? activeValue;

  return (
    <PidChipPicker
      triggerLeading={null}
      header="Effort"
      ariaLabel="Select thinking effort"
      value={activeValue}
      options={options}
      onChange={(v) => setPendingThinkingLevel(v as ThinkingLevel)}
      triggerLabel={activeLabel}
      minPopoverWidth={140}
    />
  );
}
