import { cn } from "../../lib/cn.js";
import { useProjectsStore } from "./useProjectsStore.js";
import { useSessionsStore } from "./useSessionsStore.js";

function shortcutLabel(): string {
  if (typeof navigator !== "undefined" && /mac/i.test(navigator.platform)) {
    return "⌘N";
  }
  return "Ctrl+N";
}

/**
 * Compact chip in the sidebar header: `New ⌘N`. The shortcut is purely a visual hint for
 * now; the keyboard binding is intentionally not wired up this iteration.
 */
export function NewSessionButton() {
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const createSession = useSessionsStore((s) => s.createSession);

  const disabled = !activeProjectId;
  const label = disabled ? "Open a project first" : "New session";

  return (
    <div className="border rounded-[var(--radius-md)] border-[var(--color-border-strong)]">
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={() => {
          if (activeProjectId) {
            createSession(activeProjectId).catch(() => {});
          }
        }}
        className={cn(
          "inline-flex items-stretch overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-panel-2)] text-xs text-[var(--color-text)] transition-colors",
          "hover:bg-[var(--color-panel-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-panel-2)]",
        )}
      >
        <span className="px-2 py-0.5">New</span>
        <kbd className="flex items-center border-l border-[var(--color-border-strong)] bg-[var(--color-panel-hover)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">
          {shortcutLabel()}
        </kbd>
      </button>
    </div>
  );
}
