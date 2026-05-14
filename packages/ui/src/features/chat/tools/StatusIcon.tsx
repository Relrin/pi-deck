import { Check, Square, X } from "../../../components/icons/index.js";
import { Spinner } from "../../../components/ui/Spinner.js";
import type { ToolCallStatus } from "../types.js";

export function StatusIcon({ status }: { status: ToolCallStatus }) {
  switch (status) {
    case "pending":
    case "running":
      return <Spinner size={14} className="text-[var(--color-accent)]" />;
    case "done":
      return <Check size={14} className="text-[var(--color-success)]" aria-label="done" />;
    case "error":
      return <X size={14} className="text-[var(--color-danger)]" aria-label="error" />;
    case "cancelled":
      return (
        <Square size={14} className="text-[var(--color-text-subtle)]" aria-label="cancelled" />
      );
  }
}
