import type { ThinkingLevel } from "@pi-deck/core/domain/session.js";
import { useMemo } from "react";
import { PidChipPicker, type PidChipPickerOption } from "../../components/picker/PidChipPicker.js";
import { useI18nContext } from "../../i18n/i18n-react.js";
import type { TranslationFunctions } from "../../i18n/i18n-types.js";
import { useProvidersStore } from "../models/useProvidersStore.js";
import { useSessionDefaultsStore } from "../settings/useSessionDefaultsStore.js";
import { useIntroComposerStore } from "./useIntroComposerStore.js";

interface EffortLevel {
  value: ThinkingLevel;
  label: string;
}

/** The protocol values, without any copy attached. */
const EFFORT_VALUES: readonly ThinkingLevel[] = ["low", "medium", "high"];

/**
 * Built per render from the catalog rather than held as a module constant — see the note on the
 * other option tables. Exported for `test/i18n/option-tables.test.ts`.
 */
export function effortLevelOptions(t: TranslationFunctions): EffortLevel[] {
  const copy = t.intro.effort;
  return [
    { value: "low", label: copy.low() },
    { value: "medium", label: copy.medium() },
    { value: "high", label: copy.high() },
  ];
}

export function PidEffortPicker() {
  const { LL } = useI18nContext();
  const providers = useProvidersStore((s) => s.providers);
  const modelsByProvider = useProvidersStore((s) => s.modelsByProvider);
  const defaultModel = useProvidersStore((s) => s.defaultModel);

  const pendingModelRef = useIntroComposerStore((s) => s.pendingModelRef);
  const defaultThinkingLevel = useSessionDefaultsStore((s) => s.defaultThinkingLevel);
  const setDefaultThinkingLevel = useSessionDefaultsStore((s) => s.setDefaultThinkingLevel);

  const activeRef = pendingModelRef ?? defaultModel;
  const activeModel = useMemo(() => {
    if (!activeRef) return undefined;
    return modelsByProvider[activeRef.providerId]?.find((m) => m.id === activeRef.modelId);
  }, [activeRef, modelsByProvider]);

  // Pre-models-load (or for models we don't know about yet) we optimistically allow all
  // three levels rather than greying out the chip — backend will reject if unsupported.
  // Keyed on EFFORT_VALUES rather than on the option table: which levels a model *allows* is a
  // protocol question, so this memo deliberately has no catalog dependency and does not recompute
  // on a language switch. Only the labels below come from the catalog.
  const allowedLevels = useMemo<Set<ThinkingLevel>>(() => {
    if (!activeModel) return new Set(EFFORT_VALUES);
    if (!activeModel.supportsThinking) return new Set();
    const supplied = new Set(activeModel.thinkingLevels ?? []);
    return new Set(EFFORT_VALUES.filter((value) => supplied.has(value)));
  }, [activeModel]);

  // Hide the chip entirely when the resolved model is known and explicitly doesn't think —
  // consistent with how ThinkingLevelPicker.tsx behaves inside chat sessions.
  if (activeModel && !activeModel.supportsThinking) return null;
  // Force the suppression of unused-providers warning while still subscribing for re-renders.
  void providers;

  const activeValue = defaultThinkingLevel;
  const options: PidChipPickerOption[] = effortLevelOptions(LL).map((l) => ({
    value: l.value,
    label: l.label,
    disabled: !allowedLevels.has(l.value),
  }));

  const activeLabel =
    effortLevelOptions(LL).find((l) => l.value === activeValue)?.label ?? activeValue;

  return (
    <PidChipPicker
      triggerLeading={null}
      header={LL.intro.effort.header()}
      ariaLabel={LL.intro.effort.label()}
      value={activeValue}
      options={options}
      onChange={(v) => setDefaultThinkingLevel(v as ThinkingLevel)}
      triggerLabel={activeLabel}
      minPopoverWidth={110}
    />
  );
}
