import type { ReactElement } from "react";

export type GlyphKind =
  | "session"
  | "sessions"
  | "context"
  | "cmd"
  | "palette"
  | "agent"
  | "user"
  | "tool"
  | "plan"
  | "system"
  | "error"
  | "play"
  | "pause"
  | "stop"
  | "diff";

// Each entry is the inner SVG markup for a 14x14 viewBox
export const GLYPH_PRIMITIVES: Record<GlyphKind, ReactElement> = {
  sessions: (
    <>
      <line x1="2" y1="4" x2="12" y2="4" />
      <line x1="2" y1="7" x2="12" y2="7" />
      <line x1="2" y1="10" x2="9" y2="10" />
    </>
  ),
  // Single-session glyph: a filled-dot marker on a row.
  session: (
    <>
      <circle cx="3.5" cy="7" r="1.5" fill="currentColor" />
      <line x1="6.5" y1="7" x2="12" y2="7" />
    </>
  ),
  diff: (
    <>
      <line x1="3" y1="3.5" x2="3" y2="10.5" />
      <line x1="1.5" y1="5" x2="4.5" y2="5" />
      <line x1="9.5" y1="9" x2="12.5" y2="9" />
    </>
  ),
  agent: (
    <>
      <rect x="2.5" y="4" width="9" height="7" rx="1" />
      <circle cx="5.5" cy="7.5" r="0.6" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="0.6" fill="currentColor" />
      <line x1="7" y1="2" x2="7" y2="4" />
    </>
  ),
  user: (
    <>
      <circle cx="7" cy="5" r="2" />
      <path d="M2.5 12 Q2.5 8 7 8 Q11.5 8 11.5 12" />
    </>
  ),
  tool: (
    <>
      <path d="M9.5 3 L11 4.5 L7.5 8 L6 6.5 Z" />
      <line x1="6" y1="6.5" x2="3" y2="9.5" />
      <rect x="2" y="9" width="3" height="3" />
    </>
  ),
  plan: (
    <>
      <rect x="2.5" y="2.5" width="9" height="9" />
      <line x1="4.5" y1="5.5" x2="9.5" y2="5.5" />
      <line x1="4.5" y1="8.5" x2="9.5" y2="8.5" />
    </>
  ),
  system: (
    <>
      <circle cx="7" cy="7" r="4" />
      <line x1="7" y1="3" x2="7" y2="5" />
      <line x1="7" y1="9" x2="7" y2="11" />
      <line x1="3" y1="7" x2="5" y2="7" />
      <line x1="9" y1="7" x2="11" y2="7" />
    </>
  ),
  error: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <line x1="7" y1="4" x2="7" y2="8" />
      <circle cx="7" cy="10" r="0.6" fill="currentColor" />
    </>
  ),
  play: (
    <>
      <path d="M4 3 L11 7 L4 11 Z" />
    </>
  ),
  pause: (
    <>
      <rect x="3.5" y="3" width="2.5" height="8" />
      <rect x="8" y="3" width="2.5" height="8" />
    </>
  ),
  stop: (
    <>
      <rect x="3" y="3" width="8" height="8" />
    </>
  ),
  palette: (
    <>
      <path d="M7 2 Q2 2 2 7 Q2 12 7 12 Q9 12 9 10 Q9 9 10 9 Q12 9 12 7 Q12 2 7 2 Z" />
      <circle cx="4.5" cy="6" r="0.6" fill="currentColor" />
      <circle cx="7" cy="4.5" r="0.6" fill="currentColor" />
      <circle cx="9.5" cy="6" r="0.6" fill="currentColor" />
    </>
  ),
  context: (
    <>
      <rect x="2" y="2.5" width="10" height="9" />
      <line x1="2" y1="5.5" x2="12" y2="5.5" />
      <line x1="5" y1="2.5" x2="5" y2="11.5" />
    </>
  ),
  cmd: (
    <>
      <rect x="3" y="3" width="8" height="8" />
      <rect x="1.5" y="1.5" width="3" height="3" />
      <rect x="9.5" y="1.5" width="3" height="3" />
      <rect x="1.5" y="9.5" width="3" height="3" />
      <rect x="9.5" y="9.5" width="3" height="3" />
    </>
  ),
};
