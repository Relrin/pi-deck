import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";
import type { PidButtonVariant } from "./PidButton";

export interface PidIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The icon element to render (e.g. `<X size={14} />`). */
  icon: ReactNode;
  /** Required accessible label (the button has no visible text). */
  label: string;
  variant?: PidButtonVariant;
  active?: boolean;
}

export const PidIconButton = forwardRef<HTMLButtonElement, PidIconButtonProps>(
  function PidIconButton(
    { icon, label, variant = "default", active = false, className, type = "button", ...rest },
    ref,
  ) {
    const classes = ["pid-icon-btn", className].filter(Boolean).join(" ");
    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        aria-label={label}
        data-variant={variant === "default" ? undefined : variant}
        data-active={active || undefined}
        {...rest}
      >
        {icon}
      </button>
    );
  },
);
