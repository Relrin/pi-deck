import type { ThinkingLevel } from "@pi-deck/core/domain/session.js";
import { useMemo } from "react";
import {
  PidChipPicker,
  type PidChipPickerOption,
} from "../../../components/picker/PidChipPicker.js";
import { useProvidersStore } from "../../models/useProvidersStore.js";
import { useSessionsStore } from "../../sessions/useSessionsStore.js";

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

interface SessionEffortPickerProps {
  sessionId: string;
}

export function SessionEffortPicker({ sessionId }: SessionEffortPickerProps) {
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
    if (!activeModel) return new Set(LEVELS.map((l) => l.value));
    if (!activeModel.supportsThinking) return new Set();
    const supplied = new Set(activeModel.thinkingLevels ?? []);
    return new Set(LEVELS.filter((l) => supplied.has(l.value)).map((l) => l.value));
  }, [activeModel]);

  if (activeModel && !activeModel.supportsThinking) return null;

  // Adaptive-thinking models ignore explicit level budgets — the model picks effort on its own.
  if (activeModel?.adaptiveThinking) {
    return (
      <span
        className="pid-picker-trigger"
        data-static
        title="Adaptive thinking — managed by the model"
      >
        <span className="pid-picker-trigger-label">Adaptive</span>
      </span>
    );
  }

  const activeValue = sessionSelection?.thinkingLevel ?? session?.thinkingLevel ?? DEFAULT_LEVEL;
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
      onChange={(v) => void setSessionThinkingLevel(sessionId, v as ThinkingLevel)}
      triggerLabel={activeLabel}
      minPopoverWidth={140}
    />
  );
}
