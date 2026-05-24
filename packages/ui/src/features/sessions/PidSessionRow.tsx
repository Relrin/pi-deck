import type { SessionSummary } from "@pi-deck/core/domain/session.js";
import { useState } from "react";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog.js";
import { ContextMenu, type ContextMenuItem } from "../../components/ui/ContextMenu.js";
import { relativeTime } from "../../lib/format/relative-time";
import { useNavStore } from "../../lib/useNavStore";
import { useSessionsStore } from "./useSessionsStore";

export interface PidSessionRowProps {
  session: SessionSummary;
  active: boolean;
}

export function PidSessionRow({ session, active }: PidSessionRowProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onClick = () => {
    useSessionsStore
      .getState()
      .activateSession(session.id)
      .catch(() => {});
    useNavStore.getState().goToSession();
  };

  const menuItems: ContextMenuItem[] = [
    session.archived
      ? {
          label: "Unarchive",
          onSelect: () => {
            void useSessionsStore.getState().unarchiveSession(session.id);
          },
        }
      : {
          label: "Archive",
          onSelect: () => {
            void useSessionsStore.getState().archiveSession(session.id);
          },
        },
    {
      label: "Delete",
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
          title={session.title}
        >
          <span className="pid-rail-row-status" data-tone={active ? "active" : undefined} />
          <span className="pid-rail-row-main">
            <span className="pid-rail-row-title">{session.title}</span>
            {session.branch ? <span className="pid-rail-row-branch">{session.branch}</span> : null}
          </span>
          <span className="pid-rail-row-meta">{relativeTime(session.lastActivityAt)}</span>
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
