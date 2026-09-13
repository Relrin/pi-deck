import { Check, Square, X } from "../../../components/icons/index.js";
import { Spinner } from "../../../components/ui/Spinner.js";
import { useI18nContext } from "../../../i18n/i18n-react.js";
import type { TranslationFunctions } from "../../../i18n/i18n-types.js";
import type { ToolCallStatus } from "../types.js";

interface StatusIconProps {
  status: ToolCallStatus;
  toolName?: string;
  errorText?: string;
}

export function StatusIcon({ status, toolName, errorText }: StatusIconProps) {
  const { LL } = useI18nContext();
  const label = describe(LL, status, toolName, errorText);
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

/**
 * Takes `t` rather than reaching for the imperative `ll()`: it is called during render, so the
 * strings must come from the same context the component subscribes to. `toolName` is pi's own
 * tool name and is interpolated, never translated.
 */
function describe(
  t: TranslationFunctions,
  status: ToolCallStatus,
  toolName?: string,
  errorText?: string,
): string {
  const copy = t.chat.tools.status;
  const name = toolName ?? copy.fallbackName();
  switch (status) {
    case "pending":
      return copy.queued({ name });
    case "running":
      return copy.running({ name });
    case "done":
      return copy.completed({ name });
    case "error":
      return errorText ? copy.failedWith({ name, error: errorText }) : copy.failed({ name });
    case "cancelled":
      return copy.cancelled({ name });
  }
}
