import type { SessionSummary } from "@pi-deck/core/domain/session.js";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog.js";
import { InlineRename } from "../../components/InlineRename.js";
import { Package, Pencil, Trash2 } from "../../components/icons/index.js";
import { ContextMenu, type ContextMenuItem } from "../../components/ui/ContextMenu.js";
import { relativeTime } from "../../lib/format/relative-time";
import { useNavStore } from "../../lib/useNavStore";
import { useMessagesStore } from "../chat/useMessagesStore.js";
import { warmSession } from "./sessionWarmup.js";
import { useSessionsStore } from "./useSessionsStore";

const HOVER_PREFETCH_DELAY_MS = 150;

// Lucide icons render at 24px by default; the context menu wants compact 14px-ish glyphs
// to sit alongside `var(--t-12)` mono labels.
const MENU_ICON_SIZE = 14;

export interface PidSessionRowProps {
  session: SessionSummary;
  active: boolean;
}

export function PidSessionRow({ session, active }: PidSessionRowProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  // The session is "live" while its worker is mid-turn (prompt sent, no turn-end yet).
  // Only the active session can ever be in flight — but we still key by session id so the
  // selector cost stays per-row and the rendered dot follows the right session if the user
  // switches focus mid-turn.
  const live = useMessagesStore((s) => s.bySession[session.id]?.isTurnInFlight ?? false);

  const onClick = () => {
    if (editing) return;
    useSessionsStore
      .getState()
      .activateSession(session.id)
      .catch(() => {});
    useNavStore.getState().goToSession();
  };

  // Prefetch: warm this session's worker on a deliberate hover so the click that follows opens
  // instantly. Cancelled if the pointer leaves before the delay elapses.
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHoverPrefetch = () => {
    if (hoverTimer.current !== null) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };
  const onMouseEnter = () => {
    if (active || hoverTimer.current !== null) return;
    hoverTimer.current = setTimeout(() => {
      hoverTimer.current = null;
      warmSession(session.id);
    }, HOVER_PREFETCH_DELAY_MS);
  };
  // Clear a pending timer if the row unmounts mid-hover.
  useEffect(
    () => () => {
      if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
    },
    [],
  );

  const menuItems: ContextMenuItem[] = [
    {
      label: "Rename",
      icon: <Pencil size={MENU_ICON_SIZE} aria-hidden />,
      onSelect: () => setEditing(true),
    },
    { kind: "separator" },
    session.archived
      ? {
          label: "Unarchive",
          icon: <Package size={MENU_ICON_SIZE} aria-hidden />,
          onSelect: () => {
            void useSessionsStore.getState().unarchiveSession(session.id);
          },
        }
      : {
          label: "Archive",
          icon: <Package size={MENU_ICON_SIZE} aria-hidden />,
          onSelect: () => {
            void useSessionsStore.getState().archiveSession(session.id);
          },
        },
    {
      label: "Delete",
      icon: <Trash2 size={MENU_ICON_SIZE} aria-hidden />,
      danger: true,
      onSelect: () => setConfirmOpen(true),
    },
  ];

  return (
    <>
      <ContextMenu items={menuItems}>
        <button
          type="button"
          className="pid-rail-row"
          aria-current={active ? "true" : undefined}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={cancelHoverPrefetch}
          title={session.title}
        >
          <span
            className="pid-rail-row-marker"
            data-state={active ? "active" : "idle"}
            aria-hidden
          />
          <span className="pid-rail-row-main">
            {editing ? (
              <InlineRename
                initialValue={session.title}
                onSave={(value) => {
                  void useSessionsStore.getState().renameSession(session.id, value);
                }}
                onCancel={() => setEditing(false)}
                className="pid-rail-row-rename"
                inputClassName="pid-rail-row-rename-input"
                ariaLabel="Session title"
              />
            ) : (
              <span className="pid-rail-row-title">{session.title}</span>
            )}
            {session.branch ? <span className="pid-rail-row-branch">{session.branch}</span> : null}
          </span>
          {live ? (
            <span
              className="pid-rail-row-live"
              role="status"
              aria-label="Session is running"
              title="Running"
            />
          ) : (
            <span className="pid-rail-row-meta">{relativeTime(session.lastActivityAt)}</span>
          )}
        </button>
      </ContextMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete session?"
        description={`"${session.title}" and its conversation history will be removed permanently. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => useSessionsStore.getState().deleteSession(session.id)}
      />
    </>
  );
}
