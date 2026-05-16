import type { SessionSummary } from "@pi-deck/core/domain/session.js";
import { ContextMenu } from "../../components/ui/ContextMenu.js";
import { cn } from "../../lib/cn.js";
import { relativeTime } from "../../lib/format/relative-time.js";
import { useSessionsStore } from "./useSessionsStore.js";

interface SessionRowProps {
  session: SessionSummary;
  active: boolean;
}

export function SessionRow({ session, active }: SessionRowProps) {
  const activateSession = useSessionsStore((s) => s.activateSession);

  return (
    <ContextMenu
      items={[
        { label: "Rename", onSelect: () => {}, disabled: true },
        { label: "Archive", onSelect: () => {}, disabled: true },
        { label: "Delete", onSelect: () => {}, danger: true, disabled: true },
      ]}
    >
      <button
        type="button"
        onClick={() => {
          // Errors surface via the store's toast push; nothing useful to do here.
          activateSession(session.id).catch(() => {});
        }}
        aria-current={active ? "true" : undefined}
        title={session.title}
        className={cn(
          "w-full text-left px-3 py-2 text-sm flex flex-col gap-0.5 border-l-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset",
          active
            ? "bg-[color-mix(in_oklab,var(--color-accent)_14%,var(--color-panel-hover))] border-[var(--color-accent)] text-[var(--color-text)]"
            : "border-transparent text-[var(--color-text)] hover:bg-[var(--color-panel-hover)]",
        )}
      >
        <span className="truncate">{session.title}</span>
        <span className="text-xs text-[var(--color-text-subtle)]">
          {relativeTime(session.lastActivityAt)}
        </span>
      </button>
    </ContextMenu>
  );
}
