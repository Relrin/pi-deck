import { type CSSProperties, forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "../icons/index.js";

export interface PidSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Class applied to the positioning wrapper (use for layout, e.g. flex sizing). */
  wrapperClassName?: string;
  /** Inline style applied to the positioning wrapper (use for layout, e.g. flex sizing). */
  wrapperStyle?: CSSProperties;
}

/**
 * Native `<select>` with the shared `.pid-input` chrome plus a themed chevron overlay. The native
 * dropdown arrow is suppressed (`appearance: none`) so the chevron follows the active theme and
 * keeps a consistent inset from the right edge instead of butting against the border.
 *
 * Layout props target the wrapper (the element a parent flex/grid lays out); value/onChange and
 * other select attributes pass through to the inner `<select>`.
 */
export const PidSelect = forwardRef<HTMLSelectElement, PidSelectProps>(function PidSelect(
  { className, children, wrapperClassName, wrapperStyle, ...rest },
  ref,
) {
  const wrapClasses = ["pid-select-wrap", wrapperClassName].filter(Boolean).join(" ");
  const selectClasses = ["pid-input", "pid-select", className].filter(Boolean).join(" ");
  return (
    <div className={wrapClasses} style={wrapperStyle}>
      <select ref={ref} className={selectClasses} {...rest}>
        {children}
      </select>
      <ChevronDown size={14} className="pid-select-chevron" aria-hidden="true" />
    </div>
  );
});
