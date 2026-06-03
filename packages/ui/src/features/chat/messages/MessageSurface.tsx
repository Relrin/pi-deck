import type { ReactNode } from "react";

export interface MessageSurfaceProps {
  kind: "user" | "agent";
  /** Mono-formatted timestamp, e.g. "Jun 4, 20:41". */
  timestamp?: string;
  /** Full-precision timestamp shown on hover over the time tag, e.g. "Jun 4, 2026, 20:41:18". */
  timestampTitle?: string;
  /**
   * Label shown in place of "pi" on agent rows. When provided, the tag renders as
   * "PI · <agentLabel>" so the brand stays visible alongside the model name. Pass the
   * raw model id or a resolved friendly label — the component just uppercases it.
   */
  agentLabel?: string;
  /** Full model id for the tooltip, when `agentLabel` is the shortened label. */
  agentTitle?: string;
  children: ReactNode;
}

/**
 * Log-style chat row. User rows are right-aligned with a raised bubble; agent rows are
 * left-aligned plain text. A small mono tag header ("YOU 21:14" / "PI 21:14") sits above
 * the body in both cases.
 */
export function MessageSurface({
  kind,
  timestamp,
  timestampTitle,
  agentLabel,
  agentTitle,
  children,
}: MessageSurfaceProps) {
  return (
    <div className="pid-msg" data-kind={kind}>
      <div className="pid-msg-bubble">
        <div className="pid-msg-tag">
          {kind === "agent" && (
            <span className="pid-msg-tag-model" title={agentTitle ?? agentLabel ?? "pi"}>
              {agentLabel ?? "pi"}
            </span>
          )}
          {timestamp && (
            <span className="pid-msg-tag-time" title={timestampTitle}>
              {timestamp}
            </span>
          )}
          {kind === "user" && <span>you</span>}
        </div>
        <div className="pid-msg-body">{children}</div>
      </div>
    </div>
  );
}
