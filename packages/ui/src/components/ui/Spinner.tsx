import { cn } from "../../lib/cn.js";
import { Loader2 } from "../icons/index.js";

export interface SpinnerProps {
  size?: number;
  className?: string;
  /** When provided, the spinner is exposed to assistive tech with this label. */
  "aria-label"?: string;
}

export function Spinner({ size = 14, className, "aria-label": ariaLabel }: SpinnerProps) {
  // motion-safe wrapper: animate-spin only when prefers-reduced-motion is not set.
  const labelled = typeof ariaLabel === "string" && ariaLabel.length > 0;
  return (
    <Loader2
      size={size}
      className={cn("motion-safe:animate-spin", className)}
      aria-hidden={labelled ? undefined : true}
      aria-label={labelled ? ariaLabel : undefined}
      role={labelled ? "img" : undefined}
    />
  );
}
