import type { HTMLAttributes, ReactNode } from "react";
import { Glyph, type GlyphKind } from "../glyph";

export type PidChipVariant = "default" | "accent" | "add" | "del" | "mod" | "info";

export interface PidChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: PidChipVariant;
  glyph?: GlyphKind;
  children?: ReactNode;
}

export function PidChip({
  variant = "default",
  glyph,
  className,
  children,
  ...rest
}: PidChipProps) {
  const classes = ["pid-chip", className].filter(Boolean).join(" ");
  return (
    <span className={classes} data-variant={variant === "default" ? undefined : variant} {...rest}>
      {glyph ? <Glyph kind={glyph} size={10} /> : null}
      {children}
    </span>
  );
}
