import type { SessionSummary } from "@pi-deck/core/domain/session.js";
import { useEffect, useMemo, useState } from "react";
import { InlineRename } from "../../components/InlineRename.js";
import { GitBranch } from "../../components/icons/index.js";
import { relativeTime } from "../../lib/format/relative-time.js";
import { useGitStore } from "../git/useGitStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { selectTurnInFlight, useMessagesStore } from "./useMessagesStore.js";

interface ChatHeaderProps {
  session: SessionSummary;
}

export function ChatHeader({ session }: ChatHeaderProps) {
  const isInFlight = useMessagesStore(useMemo(() => selectTurnInFlight(session.id), [session.id]));
  const branch = useGitStore((s) => s.currentBranchByProject[session.projectId]);
  const [editing, setEditing] = useState(false);

  // The "Xm ago" string is computed on every render, but ticks on its own so a stalled
  // session doesn't read "just now" forever once the user is idle in the view.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="pid-chat-header">
      <div className="pid-chat-header-main">
        <div className="pid-chat-header-title-row">
          <span
            className="pid-chat-header-status"
            data-running={isInFlight || undefined}
            aria-hidden
          />
          {editing ? (
            <InlineRename
              initialValue={session.title}
              onSave={(value) => {
                void useSessionsStore.getState().renameSession(session.id, value);
              }}
              onCancel={() => setEditing(false)}
              className="pid-chat-header-title-edit"
              inputClassName="pid-chat-header-title-input"
              ariaLabel="Session title"
            />
          ) : (
            <h2
              className="pid-chat-header-title"
              title={`${session.title}\nDouble-click to rename`}
              onDoubleClick={() => setEditing(true)}
            >
              {session.title}
            </h2>
          )}
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
    </header>
  );
}
