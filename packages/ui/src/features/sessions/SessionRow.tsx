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
        onClick={() => activateSession(session.id).catch(() => {})}
        className={cn(
          "w-full text-left px-3 py-2 text-sm flex flex-col gap-0.5 border-l-2 transition-colors",
          active
            ? "bg-[var(--color-panel-hover)] border-[var(--color-accent)] text-[var(--color-text)]"
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
