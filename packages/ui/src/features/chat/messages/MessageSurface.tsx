import type { ReactNode } from "react";

export interface MessageSurfaceProps {
  kind: "user" | "agent";
  /** Mono-formatted timestamp, e.g. "21:14:18". */
  timestamp?: string;
  children: ReactNode;
}

/**
 * Log-style chat row. User rows are right-aligned with a raised bubble; agent rows are
 * left-aligned plain text. A small mono tag header ("YOU 21:14" / "PI 21:14") sits above
 * the body in both cases.
 */
export function MessageSurface({ kind, timestamp, children }: MessageSurfaceProps) {
  return (
    <div className="pid-msg" data-kind={kind}>
      <div className="pid-msg-bubble">
        <div className="pid-msg-tag">
          {kind === "agent" && <span>pi</span>}
          {timestamp && <span className="pid-msg-tag-time">{timestamp}</span>}
          {kind === "user" && <span>you</span>}
        </div>
        <div className="pid-msg-body">{children}</div>
      </div>
    </div>
  );
}
