import { List, MoreHorizontal } from "../components/icons";
import { IconButton } from "../components/ui/IconButton.legacy";

interface ResponsiveTopBarProps {
  onOpenSessions: () => void;
  onOpenContext: () => void;
}

/**
 * Compact top bar rendered only on narrow viewports. Provides explicit entry points to the
 * sidebar drawers, since on narrow widths there are no permanent panels to host them.
 */
export function ResponsiveTopBar({ onOpenSessions, onOpenContext }: ResponsiveTopBarProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 8px",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-panel)",
      }}
    >
      <IconButton label="Open sessions" onClick={onOpenSessions}>
        <List size={16} />
      </IconButton>
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "var(--color-text-muted)",
          fontFamily: "var(--font-mono)",
        }}
      >
        pi-deck
      </span>
      <IconButton label="Open context" onClick={onOpenContext}>
        <MoreHorizontal size={16} />
      </IconButton>
    </header>
  );
}
