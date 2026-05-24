import type { SessionSummary } from "@pi-deck/core/domain/session.js";
import { useEffect, useMemo, useState } from "react";
import { PidIconButton } from "../../components/buttons/PidIconButton.js";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog.js";
import { GitBranch } from "../../components/icons/index.js";
import { relativeTime } from "../../lib/format/relative-time.js";
import { useNavStore } from "../../lib/useNavStore.js";
import { useGitStore } from "../git/useGitStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { selectTurnInFlight, useMessagesStore } from "./useMessagesStore.js";

interface ChatHeaderProps {
  session: SessionSummary;
}

export function ChatHeader({ session }: ChatHeaderProps) {
  const isInFlight = useMessagesStore(useMemo(() => selectTurnInFlight(session.id), [session.id]));
  const branch = useGitStore((s) => s.currentBranchByProject[session.projectId]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // The "Xm ago" string is computed on every render, but ticks on its own so a stalled
  // session doesn't read "just now" forever once the user is idle in the view.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const onArchiveToggle = () => {
    const store = useSessionsStore.getState();
    if (session.archived) {
      void store.unarchiveSession(session.id);
    } else {
      void store.archiveSession(session.id);
    }
  };

  const onDeleteConfirmed = async () => {
    await useSessionsStore.getState().deleteSession(session.id);
    // The session is gone — return the user to the dashboard so we don't render an
    // empty chat shell against a missing record.
    useNavStore.getState().goToBlank();
  };

  return (
    <header className="pid-chat-header">
      <div className="pid-chat-header-main">
        <div className="pid-chat-header-title-row">
          <span
            className="pid-chat-header-status"
            data-running={isInFlight || undefined}
            aria-hidden
          />
          <h2 className="pid-chat-header-title" title={session.title}>
            {session.title}
          </h2>
        </div>
        <div className="pid-chat-header-meta">
          {branch && (
            <span className="pid-chat-header-meta-branch">
              <GitBranch size={11} aria-hidden />
              <span>{branch}</span>
            </span>
          )}
          {branch && <span aria-hidden>·</span>}
          <span>{relativeTime(session.lastActivityAt)}</span>
        </div>
      </div>
      <div className="pid-chat-header-actions">
        <PidIconButton
          kind="archive"
          label={session.archived ? "Unarchive session" : "Archive session"}
          title={session.archived ? "Unarchive session" : "Archive session"}
          active={session.archived}
          onClick={onArchiveToggle}
        />
        <PidIconButton
          kind="trash"
          label="Delete session"
          title="Delete session"
          variant="danger"
          onClick={() => setConfirmDeleteOpen(true)}
        />
      </div>
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete session?"
        description={`"${session.title}" and its conversation history will be removed permanently. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={onDeleteConfirmed}
      />
    </header>
  );
}
