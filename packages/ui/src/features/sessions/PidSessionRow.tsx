import type { SessionSummary } from "@pi-deck/core/domain/session.js";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog.js";
import { InlineRename } from "../../components/InlineRename.js";
import { CheckCheck, Package, Pencil, Trash2 } from "../../components/icons/index.js";
import { ContextMenu, type ContextMenuItem } from "../../components/ui/ContextMenu.js";
import { useI18nContext } from "../../i18n/i18n-react.js";
import type { TranslationFunctions } from "../../i18n/i18n-types.js";
import { relativeTime } from "../../lib/format/relative-time";
import { useNavStore } from "../../lib/useNavStore";
import type { RailStatus } from "../chat/types.js";
import { selectSessionRailStatus, useMessagesStore } from "../chat/useMessagesStore.js";
import { warmSession } from "./sessionWarmup.js";
import { useSessionsStore } from "./useSessionsStore";

const HOVER_PREFETCH_DELAY_MS = 150;

// Lucide icons render at 24px by default; the context menu wants compact 14px-ish glyphs
// to sit alongside `var(--t-12)` mono labels.
const MENU_ICON_SIZE = 14;

// Accessible name for the status dot per state. `idle` gets no label (it's the resting default —
// labelling every quiet row just adds screen-reader noise).
/**
 * Built per render from the catalog rather than held as a module constant: a module-level table
 * would capture whatever locale was loaded at import time and never update on a language switch.
 * Exported for `test/i18n/option-tables.test.ts`.
 */
export function statusLabels(t: TranslationFunctions): Record<Exclude<RailStatus, "idle">, string> {
  const copy = t.sessions.row.status;
  return {
    working: copy.working(),
    waiting: copy.waiting(),
    done: copy.done(),
    failed: copy.failed(),
  };
}

export interface PidSessionRowProps {
  session: SessionSummary;
  active: boolean;
}

export function PidSessionRow({ session, active }: PidSessionRowProps) {
  const { LL } = useI18nContext();
  const { locale } = useI18nContext();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  // Coarse lifecycle for the status dot: working / waiting / done / failed / idle. Keyed by
  // session id so the cost stays per-row and the dot follows the right session across focus
  // switches. The selector returns a primitive, so a stable status doesn't re-render the row.
  const status = useMessagesStore(selectSessionRailStatus(session.id));

  // Viewing the session you're focused on clears its done/failed dot to neutral idle. Covers the
  // "finished while you're already watching it" case; `activateSession` covers "switched to a
  // finished session", and the "Mark as completed" menu item is a manual trigger for the same
  // `markViewed` — acknowledging the turn without opening the session.
  useEffect(() => {
    if (active && (status === "done" || status === "failed")) {
      useMessagesStore.getState().markViewed(session.id);
    }
  }, [active, status, session.id]);

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

  // "Mark as completed" acknowledges a finished/failed turn — it greys the dot to idle without
  // opening the session. Only meaningful when there's a terminal outcome to acknowledge.
  const canAcknowledge = status === "done" || status === "failed";
  const menuItems: ContextMenuItem[] = [
    ...(canAcknowledge
      ? ([
          {
            label: LL.sessions.row.menu.markCompleted(),
            icon: <CheckCheck size={MENU_ICON_SIZE} aria-hidden />,
            onSelect: () => useMessagesStore.getState().markViewed(session.id),
          },
          { kind: "separator" },
        ] satisfies ContextMenuItem[])
      : []),
    {
      label: LL.sessions.row.menu.rename(),
      icon: <Pencil size={MENU_ICON_SIZE} aria-hidden />,
      onSelect: () => setEditing(true),
    },
    { kind: "separator" },
    session.archived
      ? {
          label: LL.sessions.row.menu.unarchive(),
          icon: <Package size={MENU_ICON_SIZE} aria-hidden />,
          onSelect: () => {
            void useSessionsStore.getState().unarchiveSession(session.id);
          },
        }
      : {
          label: LL.sessions.row.menu.archive(),
          icon: <Package size={MENU_ICON_SIZE} aria-hidden />,
          onSelect: () => {
            void useSessionsStore.getState().archiveSession(session.id);
          },
        },
    {
      label: LL.sessions.row.menu.delete(),
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
            className="pid-rail-row-dot"
            data-status={status}
            {...(status === "idle"
              ? { "aria-hidden": true }
              : {
                  role: "img",
                  "aria-label": statusLabels(LL)[status],
                  title: statusLabels(LL)[status],
                })}
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
                ariaLabel={LL.sessions.row.title()}
              />
            ) : (
              <span className="pid-rail-row-title">{session.title}</span>
            )}
            {session.branch ? <span className="pid-rail-row-branch">{session.branch}</span> : null}
          </span>
          <span className="pid-rail-row-meta">
            {relativeTime(session.lastActivityAt, undefined, locale)}
          </span>
        </button>
      </ContextMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={LL.sessions.row.confirmDeleteTitle()}
        description={LL.sessions.row.confirmDeleteBody({ title: session.title })}
        confirmLabel={LL.sessions.row.confirmDeleteLabel()}
        destructive
        onConfirm={() => useSessionsStore.getState().deleteSession(session.id)}
      />
    </>
  );
}
