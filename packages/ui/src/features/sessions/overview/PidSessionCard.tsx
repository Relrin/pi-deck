import type { SessionSummary } from "@pi-deck/core/domain/session.js";
import { useMemo } from "react";
import { PidChip } from "../../../components/chip/PidChip";
import { relativeTime } from "../../../lib/format/relative-time";
import { useNavStore } from "../../../lib/useNavStore";
import { useSessionsStore } from "../useSessionsStore";

export interface PidSessionCardProps {
  session: SessionSummary;
  active: boolean;
}

const DIFFBAR_BARS = 12;

interface Bar {
  id: string;
  tone: "muted" | "accent" | "add";
}

function bars(seed: string, active: boolean): Bar[] {
  // Deterministic bar pattern derived from session id — gives each card a stable but
  // distinct silhouette without needing live activity data.
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const arr: Bar[] = [];
  for (let i = 0; i < DIFFBAR_BARS; i++) {
    const v = (hash >> i) & 0b111;
    let tone: Bar["tone"];
    if (active && v % 3 === 0) tone = "accent";
    else if (v % 4 === 0) tone = "add";
    else tone = "muted";
    arr.push({ id: `${seed}:${i}`, tone });
  }
  return arr;
}

export function PidSessionCard({ session, active }: PidSessionCardProps) {
  const pattern = useMemo(() => bars(session.id, active), [session.id, active]);

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
      className="pid-card pid-session-card"
      data-active={active || undefined}
      onClick={onClick}
      title={session.title}
    >
      <span className="pid-session-card-row">
        <span className="pid-session-card-status" data-tone={active ? "active" : undefined} />
        <span className="pid-session-card-title">{session.title}</span>
      </span>
      <span className="pid-session-card-meta">
        <span className="pid-session-card-meta-branch">pi/{session.id.slice(0, 8)}</span>
        <span aria-hidden>·</span>
        <span>{relativeTime(session.lastActivityAt)}</span>
      </span>
      <span className="pid-session-card-row">
        <span className="pid-diffbar" aria-hidden>
          {pattern.map((bar) => (
            <span key={bar.id} data-tone={bar.tone === "muted" ? undefined : bar.tone} />
          ))}
        </span>
        {session.model ? <PidChip>{session.model}</PidChip> : null}
      </span>
    </button>
  );
}
