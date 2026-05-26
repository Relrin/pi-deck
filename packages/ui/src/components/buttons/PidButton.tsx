import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";

export type PidButtonVariant = "default" | "primary" | "ghost" | "danger";
export type PidButtonSize = "sm" | "md";

export interface PidButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PidButtonVariant;
  size?: PidButtonSize;
  /** Optional leading icon rendered before children. */
  icon?: ReactNode;
  /** True when the label is a sentence — switches to UI font, sentence case. */
  longLabel?: boolean;
  /** Visually marks the button as the active option in a segmented group. */
  active?: boolean;
  children?: ReactNode;
}

export const PidButton = forwardRef<HTMLButtonElement, PidButtonProps>(function PidButton(
  {
    variant = "default",
    size = "sm",
    icon,
    longLabel = false,
    active = false,
    className,
    type = "button",
    children,
    ...rest
  },
  ref,
) {
  const classes = ["pid-btn", className].filter(Boolean).join(" ");
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      data-variant={variant === "default" ? undefined : variant}
      data-size={size === "sm" ? undefined : size}
      data-long-label={longLabel || undefined}
      data-active={active || undefined}
      {...rest}
    >
      {icon ?? null}
      {children}
    </button>
  );
});
