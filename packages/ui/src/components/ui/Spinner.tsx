import { cn } from "../../lib/cn.js";
import { Loader2 } from "../icons/index.js";

export interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 14, className }: SpinnerProps) {
  return <Loader2 size={size} className={cn("animate-spin", className)} aria-hidden="true" />;
}
