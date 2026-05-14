import { Check, Square, X } from "../../../components/icons/index.js";
import { Spinner } from "../../../components/ui/Spinner.js";
import type { ToolCallStatus } from "../types.js";

interface StatusIconProps {
  status: ToolCallStatus;
  toolName?: string;
  errorText?: string;
}

export function StatusIcon({ status, toolName, errorText }: StatusIconProps) {
  const label = describe(status, toolName, errorText);
  switch (status) {
    case "pending":
    case "running":
      return <Spinner size={14} className="text-[var(--color-accent)]" aria-label={label} />;
    case "done":
      return (
        <Check size={14} className="text-[var(--color-success)]" aria-label={label} role="img" />
      );
    case "error":
      return <X size={14} className="text-[var(--color-danger)]" aria-label={label} role="img" />;
    case "cancelled":
      return (
        <Square
          size={14}
          className="text-[var(--color-text-subtle)]"
          aria-label={label}
          role="img"
        />
      );
  }
}

function describe(status: ToolCallStatus, toolName?: string, errorText?: string): string {
  const name = toolName ?? "Tool";
  switch (status) {
    case "pending":
      return `${name} is queued`;
    case "running":
      return `${name} is running`;
    case "done":
      return `${name} completed`;
    case "error":
      return errorText ? `${name} failed: ${errorText}` : `${name} failed`;
    case "cancelled":
      return `${name} cancelled`;
  }
}
