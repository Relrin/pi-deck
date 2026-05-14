import type { SessionSummary } from "@pi-deck/core/domain/session.js";

interface ChatHeaderProps {
  session: SessionSummary;
}

export function ChatHeader({ session }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-medium text-[var(--color-text)] truncate">{session.title}</h2>
      </div>
      {session.model && (
        <span className="ml-3 text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-panel-2)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-2 py-0.5">
          {session.model}
        </span>
      )}
    </header>
  );
}
