import type { HTMLAttributes, ReactNode } from "react";

export type PidChipVariant = "default" | "accent" | "add" | "del" | "mod" | "info";

export interface PidChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: PidChipVariant;
  icon?: ReactNode;
  children?: ReactNode;
}

export function PidChip({ variant = "default", icon, className, children, ...rest }: PidChipProps) {
  const classes = ["pid-chip", className].filter(Boolean).join(" ");
  return (
    <span className={classes} data-variant={variant === "default" ? undefined : variant} {...rest}>
      {icon ?? null}
      {children}
    </span>
  );
}
