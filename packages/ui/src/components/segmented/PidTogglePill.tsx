import type { ReactNode } from "react";

export interface PidTogglePillProps {
  /** Display text on the left of the switch. */
  label: string;
  /** Optional leading icon. */
  icon?: ReactNode;
  /** Optional hover tooltip explaining the setting. */
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible label override — defaults to `label`. Use when the visible label is
   * ambiguous in isolation (e.g. "Wrapping" in a list of unrelated toggles). */
  ariaLabel?: string;
}

/**
 * Pill chrome with `[icon] [label] [switch]` laid out left-to-right. The whole pill
 * is the activation surface so the user can click anywhere on it to flip the switch.
 * Designed for in-line, atomic boolean preferences — drop several side-by-side in a
 * settings block when the choices are independent (e.g. Backgrounds / Line Numbers /
 * Wrapping inside Settings → Git & GitHub).
 *
 * For mutually-exclusive choices use `PidSegmentedPill` instead.
 */
export function PidTogglePill({
  label,
  icon,
  description,
  checked,
  onChange,
  ariaLabel,
}: PidTogglePillProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      title={description}
      data-checked={checked || undefined}
      className="pid-toggle-pill"
      onClick={() => onChange(!checked)}
    >
      {icon ? (
        <span className="pid-toggle-pill-icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="pid-toggle-pill-label">{label}</span>
      <span className="pid-toggle-pill-switch" aria-hidden>
        <span className="pid-toggle-pill-thumb" />
      </span>
    </button>
  );
}
