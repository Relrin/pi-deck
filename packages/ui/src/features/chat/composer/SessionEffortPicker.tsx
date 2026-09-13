import type { ThinkingLevel } from "@pi-deck/core/domain/session.js";
import { useMemo } from "react";
import { Brain } from "../../../components/icons/index.js";
import {
  PidChipPicker,
  type PidChipPickerOption,
} from "../../../components/picker/PidChipPicker.js";
import { useI18nContext } from "../../../i18n/i18n-react.js";
import type { TranslationFunctions } from "../../../i18n/i18n-types.js";
import { useProvidersStore } from "../../models/useProvidersStore.js";
import { useSessionsStore } from "../../sessions/useSessionsStore.js";

interface EffortLevel {
  value: ThinkingLevel;
  label: string;
}

/** Built per render — a module constant would freeze the launch locale. */
export function effortLevels(t: TranslationFunctions): EffortLevel[] {
  const copy = t.chat.effortPicker.level;
  return [
    { value: "low", label: copy.low() },
    { value: "medium", label: copy.medium() },
    { value: "high", label: copy.high() },
  ];
}

const DEFAULT_LEVEL: ThinkingLevel = "medium";

interface SessionEffortPickerProps {
  sessionId: string;
}

export function SessionEffortPicker({ sessionId }: SessionEffortPickerProps) {
  const { LL } = useI18nContext();
  const levels = effortLevels(LL);
  const session = useSessionsStore((s) => s.sessions.find((x) => x.id === sessionId));
  const modelsByProvider = useProvidersStore((s) => s.modelsByProvider);
  const sessionSelection = useProvidersStore((s) => s.sessionSelection[sessionId]);
  const setSessionThinkingLevel = useProvidersStore((s) => s.setSessionThinkingLevel);

  const modelRef = sessionSelection?.modelRef ?? session?.modelRef;
  const activeModel = useMemo(() => {
    if (!modelRef) return undefined;
    return modelsByProvider[modelRef.providerId]?.find((m) => m.id === modelRef.modelId);
  }, [modelRef, modelsByProvider]);

  const allowedLevels = useMemo<Set<ThinkingLevel>>(() => {
    if (!activeModel) return new Set(levels.map((l) => l.value));
    if (!activeModel.supportsThinking) return new Set();
    const supplied = new Set(activeModel.thinkingLevels ?? []);
    return new Set(levels.filter((l) => supplied.has(l.value)).map((l) => l.value));
  }, [activeModel, levels]);

  if (activeModel && !activeModel.supportsThinking) return null;

  // Adaptive-thinking models ignore explicit level budgets — the model picks effort on its own.
  if (activeModel?.adaptiveThinking) {
    return (
      <span
        className="pid-picker-trigger"
        data-static
        title={LL.chat.effortPicker.adaptiveTooltip()}
      >
        <Brain size={12} className="pid-picker-trigger-icon" aria-hidden />
        <span className="pid-picker-trigger-label">{LL.chat.effortPicker.adaptive()}</span>
      </span>
    );
  }

  const activeValue = sessionSelection?.thinkingLevel ?? session?.thinkingLevel ?? DEFAULT_LEVEL;
  const options: PidChipPickerOption[] = levels.map((l) => ({
    value: l.value,
    label: l.label,
    disabled: !allowedLevels.has(l.value),
  }));

  const activeLabel = levels.find((l) => l.value === activeValue)?.label ?? activeValue;

  return (
    <PidChipPicker
      triggerLeading={<Brain size={12} className="pid-picker-trigger-icon" aria-hidden />}
      header={LL.chat.effortPicker.header()}
      ariaLabel={LL.chat.effortPicker.ariaLabel()}
      value={activeValue}
      options={options}
      onChange={(v) => void setSessionThinkingLevel(sessionId, v as ThinkingLevel)}
      triggerLabel={activeLabel}
      minPopoverWidth={110}
    />
  );
}
