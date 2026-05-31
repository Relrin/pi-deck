import type { ReactNode } from "react";

export interface PidSegmentedPillOption<T extends string> {
  value: T;
  label: string;
  /** Optional leading icon (typically a 12–14px lucide glyph). */
  icon?: ReactNode;
  /** Optional title — surfaces as a hover tooltip explaining the option. */
  description?: string;
}

export interface PidSegmentedPillProps<T extends string> {
  value: T;
  options: PidSegmentedPillOption<T>[];
  onChange: (value: T) => void;
  /** Required accessible label for the underlying radiogroup. */
  ariaLabel: string;
  /** Optional name attribute (only relevant when the control is part of a form). */
  name?: string;
  className?: string;
}

/**
 * Connected-pill segmented control. Visually a single rounded chrome with internal
 * dividers; the active segment carries a lifted background. Use for short,
 * mutually-exclusive choices where the segments belong together (e.g. diff line style:
 * "Bars / Classic / None").
 *
 * Differs from the existing `.pid-segmented` (used by Density / Fonts in the
 * Appearance section) which renders each option as a separate `PidButton` with gaps —
 * that style reads as discrete buttons; this one reads as a single picker.
 */
export function PidSegmentedPill<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  name,
  className,
}: PidSegmentedPillProps<T>) {
  const classes = ["pid-segmented-pill", className].filter(Boolean).join(" ");
  return (
    <div className={classes} role="radiogroup" aria-label={ariaLabel} data-name={name || undefined}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          // biome-ignore lint/a11y/useSemanticElements: native <input type="radio"> can't carry the icon + label chrome; <button role="radio"> is the standard ARIA pattern for visually-rich segmented controls and keeps keyboard activation.
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active || undefined}
            className="pid-segmented-pill-option"
            title={option.description}
            onClick={() => onChange(option.value)}
          >
            {option.icon ? (
              <span className="pid-segmented-pill-icon" aria-hidden>
                {option.icon}
              </span>
            ) : null}
            <span className="pid-segmented-pill-label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
