import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

/**
 * Generic empty-state surface. Centered icon + title + description + optional CTA.
 * Used by `MainPanel` (no session selected, no project open) and the sessions sidebar
 * (no sessions yet, no project open).
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center text-[var(--color-text)]",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-10",
        className,
      )}
      role="status"
    >
      {icon && (
        <div className="text-[var(--color-text-subtle)]" aria-hidden="true">
          {icon}
        </div>
      )}
      <h2
        className={cn(
          "font-medium",
          compact ? "text-sm text-[var(--color-text-muted)]" : "text-base",
        )}
      >
        {title}
      </h2>
      {description && (
        <p className="text-sm text-[var(--color-text-muted)] max-w-md">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
