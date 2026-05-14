import { useEffect } from "react";
import { X } from "../../components/icons/index.js";
import { cn } from "../../lib/cn.js";
import { TOAST_DISMISS_MS } from "../../lib/ui-constants.js";
import { useToastStore } from "./useToastStore.js";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => dismiss(t.id), TOAST_DISMISS_MS - (Date.now() - t.createdAt)),
    );
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex max-w-md items-start gap-3 rounded-[var(--radius-md)] border px-3 py-2 text-sm shadow-lg",
            toast.kind === "error"
              ? "bg-[var(--color-panel-2)] border-[var(--color-danger)] text-[var(--color-text)]"
              : "bg-[var(--color-panel-2)] border-[var(--color-border)] text-[var(--color-text)]",
          )}
        >
          <span className="flex-1 break-words">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            className="text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
