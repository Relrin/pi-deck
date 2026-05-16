import type { SessionSummary } from "@pi-deck/core/domain/session.js";
import { relativeTime } from "../../lib/format/relative-time";
import { useNavStore } from "../../lib/useNavStore";
import { useSessionsStore } from "./useSessionsStore";

export interface PidSessionRowProps {
  session: SessionSummary;
  active: boolean;
}

export function PidSessionRow({ session, active }: PidSessionRowProps) {
  const onClick = () => {
    useSessionsStore
      .getState()
      .activateSession(session.id)
      .catch(() => {});
    useNavStore.getState().goToSession();
  };

  return (
    <button
      type="button"
      className="pid-rail-row"
      aria-current={active ? "true" : undefined}
      onClick={onClick}
      title={session.title}
    >
      <span className="pid-rail-row-status" data-tone={active ? "active" : undefined} />
      <span className="pid-rail-row-title">{session.title}</span>
      <span className="pid-rail-row-meta">{relativeTime(session.lastActivityAt)}</span>
    </button>
  );
}
