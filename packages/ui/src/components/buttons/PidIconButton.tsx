import { type ButtonHTMLAttributes, forwardRef } from "react";
import { Glyph, type GlyphKind } from "../glyph";
import type { PidButtonVariant } from "./PidButton";

export interface PidIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind: GlyphKind;
  /** Required accessible label (the button has no visible text). */
  label: string;
  variant?: PidButtonVariant;
  active?: boolean;
  /** Optional explicit glyph size; defaults to 14px. */
  glyphSize?: number;
}

export const PidIconButton = forwardRef<HTMLButtonElement, PidIconButtonProps>(
  function PidIconButton(
    {
      kind,
      label,
      variant = "default",
      active = false,
      glyphSize,
      className,
      type = "button",
      ...rest
    },
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
        <Glyph kind={kind} size={glyphSize} />
      </button>
    );
  },
);
