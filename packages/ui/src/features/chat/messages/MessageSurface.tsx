import type { ReactNode } from "react";
import { cn } from "../../../lib/cn.js";

export interface MessageSurfaceProps {
  align: "left" | "right";
  children: ReactNode;
  className?: string;
}

export function MessageSurface({ align, children, className }: MessageSurfaceProps) {
  return (
    <div className={cn("flex w-full", align === "right" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(48rem,90%)] rounded-[var(--radius-md)] px-3 py-2 text-sm border",
          align === "right"
            ? "bg-[var(--color-panel-2)] border-[var(--color-border)] text-[var(--color-text)]"
            : "bg-transparent border-transparent text-[var(--color-text)]",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
