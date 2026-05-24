import type { SessionSummary } from "@pi-deck/core/domain/session.js";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog.js";
import { Package, Pencil, Trash2 } from "../../components/icons/index.js";
import { ContextMenu, type ContextMenuItem } from "../../components/ui/ContextMenu.js";
import { relativeTime } from "../../lib/format/relative-time";
import { useNavStore } from "../../lib/useNavStore";
import { useSessionsStore } from "./useSessionsStore";

// Lucide icons render at 24px by default; the context menu wants compact 12px-ish glyphs
// to sit alongside `var(--t-12)` mono labels.
const MENU_ICON_SIZE = 14;

export interface PidSessionRowProps {
  session: SessionSummary;
  active: boolean;
}

export function PidSessionRow({ session, active }: PidSessionRowProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const onClick = () => {
    if (editing) return;
    useSessionsStore
      .getState()
      .activateSession(session.id)
      .catch(() => {});
    useNavStore.getState().goToSession();
  };

  const menuItems: ContextMenuItem[] = [
    {
      label: "Rename",
      icon: <Pencil size={MENU_ICON_SIZE} aria-hidden />,
      shortcut: "F2",
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
          title={session.title}
        >
          <span className="pid-rail-row-status" data-tone={active ? "active" : undefined} />
          <span className="pid-rail-row-main">
            {editing ? (
              <InlineRenameField
                sessionId={session.id}
                initialTitle={session.title}
                onDone={() => setEditing(false)}
              />
            ) : (
              <span className="pid-rail-row-title">{session.title}</span>
            )}
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

interface InlineRenameFieldProps {
  sessionId: string;
  initialTitle: string;
  onDone: () => void;
}

/**
 * Inline text editor that takes over the row's title slot during a rename. Enter / blur
 * commit, Escape cancels. The form swallows clicks so the row's onClick doesn't activate
 * the session while the user is typing.
 */
function InlineRenameField({ sessionId, initialTitle, onDone }: InlineRenameFieldProps) {
  const [value, setValue] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const commit = (next: string) => {
    if (committedRef.current) return;
    committedRef.current = true;
    const trimmed = next.trim();
    if (trimmed && trimmed !== initialTitle) {
      void useSessionsStore.getState().renameSession(sessionId, trimmed);
    }
    onDone();
  };

  const cancel = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onDone();
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    commit(value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    }
  };

  return (
    <form className="pid-rail-row-rename" onSubmit={onSubmit}>
      <input
        ref={inputRef}
        type="text"
        className="pid-rail-row-rename-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => commit(value)}
        onKeyDown={onKeyDown}
        // Swallow click so the outer row's onClick doesn't fire activateSession while the
        // user is positioning the caret inside the rename field.
        onClick={(e) => e.stopPropagation()}
        aria-label="Session title"
      />
    </form>
  );
}
