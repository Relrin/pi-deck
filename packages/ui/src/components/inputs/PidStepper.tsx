import { useEffect, useState } from "react";
import { Minus, Plus } from "../icons/index.js";

export interface PidStepperProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  /** Accessible label for the value field and the group. */
  ariaLabel?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Themed numeric stepper: a `[−] value [+]` pill that replaces the native `<input type=number>`
 * spinner (which renders as cramped, off-theme up/down chevrons — especially on Windows). The
 * middle field stays keyboard-editable via a local draft that commits on blur / Enter, so typing
 * isn't fought by clamping mid-keystroke; the buttons step by `step` and clamp to `[min, max]`.
 */
export function PidStepper({
  value,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  onChange,
  ariaLabel,
}: PidStepperProps) {
  const [draft, setDraft] = useState(String(value));

  // Keep the field in sync when the value changes from elsewhere (e.g. the +/- buttons).
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (raw.trim() === "" || Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = clamp(Math.round(parsed), min, max);
    onChange(next);
    setDraft(String(next));
  };

  const stepBy = (delta: number) => onChange(clamp(value + delta, min, max));

  return (
    <div className="pid-stepper">
      <button
        type="button"
        className="pid-stepper-btn"
        aria-label={ariaLabel ? `Decrease ${ariaLabel}` : "Decrease"}
        disabled={value <= min}
        onClick={() => stepBy(-step)}
      >
        <Minus size={13} aria-hidden="true" />
      </button>
      <input
        className="pid-stepper-value"
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={draft}
        min={Number.isFinite(min) ? min : undefined}
        max={Number.isFinite(max) ? max : undefined}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
        }}
      />
      <button
        type="button"
        className="pid-stepper-btn"
        aria-label={ariaLabel ? `Increase ${ariaLabel}` : "Increase"}
        disabled={value >= max}
        onClick={() => stepBy(step)}
      >
        <Plus size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
