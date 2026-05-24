import type { ReactElement } from "react";

export type GlyphKind =
  | "session"
  | "sessions"
  | "file"
  | "files"
  | "folder"
  | "diff"
  | "commit"
  | "branch"
  | "agent"
  | "user"
  | "tool"
  | "plan"
  | "system"
  | "error"
  | "play"
  | "pause"
  | "stop"
  | "search"
  | "settings"
  | "palette"
  | "chevron-right"
  | "chevron-down"
  | "close"
  | "plus"
  | "check"
  | "panel-left"
  | "panel-right"
  | "panel-bottom"
  | "sliders"
  | "terminal"
  | "sparkle"
  | "pull"
  | "arrow-right"
  | "merge"
  | "history"
  | "git"
  | "context"
  | "cmd"
  | "send"
  | "attach"
  | "upload"
  | "archive"
  | "trash";

// Each entry is the inner SVG markup for a 14x14 viewBox. Paths ported from
// plans/design-mockup/html-css-mockup/glyphs.jsx with mockup-specific keys
// (panel-l, chevron-d, cross, dot3, circle-dot) mapped to the canonical kinds.
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
  files: (
    <>
      <rect x="2.5" y="2" width="7" height="10" />
      <line x1="9.5" y1="2" x2="11.5" y2="4" />
      <line x1="11.5" y1="4" x2="11.5" y2="12" />
      <line x1="11.5" y1="12" x2="9.5" y2="12" />
    </>
  ),
  // file: single doc outline (no folded corner)
  file: (
    <>
      <rect x="3" y="2" width="8" height="10" />
    </>
  ),
  folder: (
    <>
      <path d="M2 4 L5.5 4 L7 5.5 L12 5.5 L12 11.5 L2 11.5 Z" />
    </>
  ),
  diff: (
    <>
      <line x1="3" y1="3.5" x2="3" y2="10.5" />
      <line x1="1.5" y1="5" x2="4.5" y2="5" />
      <line x1="9.5" y1="9" x2="12.5" y2="9" />
    </>
  ),
  commit: (
    <>
      <circle cx="7" cy="7" r="2" />
      <line x1="2" y1="7" x2="5" y2="7" />
      <line x1="9" y1="7" x2="12" y2="7" />
    </>
  ),
  branch: (
    <>
      <circle cx="3.5" cy="3.5" r="1.2" />
      <circle cx="3.5" cy="10.5" r="1.2" />
      <circle cx="10.5" cy="3.5" r="1.2" />
      <line x1="3.5" y1="4.7" x2="3.5" y2="9.3" />
      <path d="M3.5 7 L10.5 7 L10.5 4.7" />
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
  search: (
    <>
      <circle cx="6" cy="6" r="3.5" />
      <line x1="8.5" y1="8.5" x2="11.5" y2="11.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="7" cy="7" r="2" />
      <line x1="7" y1="1.5" x2="7" y2="3.5" />
      <line x1="7" y1="10.5" x2="7" y2="12.5" />
      <line x1="1.5" y1="7" x2="3.5" y2="7" />
      <line x1="10.5" y1="7" x2="12.5" y2="7" />
      <line x1="3" y1="3" x2="4.5" y2="4.5" />
      <line x1="9.5" y1="9.5" x2="11" y2="11" />
      <line x1="11" y1="3" x2="9.5" y2="4.5" />
      <line x1="4.5" y1="9.5" x2="3" y2="11" />
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
  "chevron-right": (
    <>
      <path d="M5.5 3.5 L9 7 L5.5 10.5" />
    </>
  ),
  "chevron-down": (
    <>
      <path d="M3.5 5.5 L7 9 L10.5 5.5" />
    </>
  ),
  close: (
    <>
      <line x1="3" y1="3" x2="11" y2="11" />
      <line x1="11" y1="3" x2="3" y2="11" />
    </>
  ),
  plus: (
    <>
      <line x1="7" y1="2.5" x2="7" y2="11.5" />
      <line x1="2.5" y1="7" x2="11.5" y2="7" />
    </>
  ),
  check: (
    <>
      <path d="M3 7.5 L6 10 L11 4" />
    </>
  ),
  "panel-left": (
    <>
      <rect x="2" y="2.5" width="10" height="9" />
      <line x1="5.5" y1="2.5" x2="5.5" y2="11.5" />
    </>
  ),
  "panel-right": (
    <>
      <rect x="2" y="2.5" width="10" height="9" />
      <line x1="8.5" y1="2.5" x2="8.5" y2="11.5" />
    </>
  ),
  "panel-bottom": (
    <>
      <rect x="2" y="2.5" width="10" height="9" />
      <line x1="2" y1="8.5" x2="12" y2="8.5" />
    </>
  ),
  sliders: (
    <>
      <line x1="2.5" y1="4" x2="11.5" y2="4" />
      <line x1="2.5" y1="10" x2="11.5" y2="10" />
      <circle cx="9" cy="4" r="1.2" fill="var(--bg-1)" />
      <circle cx="5" cy="10" r="1.2" fill="var(--bg-1)" />
    </>
  ),
  terminal: (
    <>
      <rect x="2" y="3" width="10" height="8" />
      <path d="M4 6 L5.5 7.5 L4 9" />
      <line x1="7" y1="9" x2="10" y2="9" />
    </>
  ),
  sparkle: (
    <>
      <path d="M7 2 L8 6 L12 7 L8 8 L7 12 L6 8 L2 7 L6 6 Z" />
    </>
  ),
  pull: (
    <>
      <circle cx="3.5" cy="3.5" r="1.2" />
      <circle cx="3.5" cy="10.5" r="1.2" />
      <circle cx="10.5" cy="10.5" r="1.2" />
      <line x1="3.5" y1="4.7" x2="3.5" y2="9.3" />
      <path d="M10.5 9.3 L10.5 6 L7 6" />
      <path d="M5 4 L7 6 L5 8" />
    </>
  ),
  "arrow-right": (
    <>
      <line x1="2.5" y1="7" x2="11" y2="7" />
      <path d="M8 4 L11 7 L8 10" />
    </>
  ),
  merge: (
    <>
      <circle cx="3.5" cy="3.5" r="1.2" />
      <circle cx="10.5" cy="3.5" r="1.2" />
      <circle cx="7" cy="10.5" r="1.2" />
      <line x1="3.5" y1="4.7" x2="3.5" y2="7" />
      <line x1="10.5" y1="4.7" x2="10.5" y2="7" />
      <path d="M3.5 7 Q3.5 9 7 9.3 Q10.5 9 10.5 7" />
    </>
  ),
  history: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <line x1="7" y1="4" x2="7" y2="7" />
      <line x1="7" y1="7" x2="9.5" y2="8.5" />
    </>
  ),
  git: (
    <>
      <circle cx="3.5" cy="3.5" r="1.5" />
      <circle cx="3.5" cy="10.5" r="1.5" />
      <circle cx="10.5" cy="7" r="1.5" />
      <line x1="3.5" y1="5" x2="3.5" y2="9" />
      <path d="M3.5 7 Q3.5 7 7 7 Q9 7 9 7" />
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
  send: (
    <>
      <path d="M2 12 L12 2" />
      <path d="M2 12 L6 8.5" />
      <path d="M12 2 L8.5 6" />
    </>
  ),
  attach: (
    <>
      <path d="M9 4 L4.5 8.5 Q3 10 4.5 11.5 Q6 13 7.5 11.5 L11 8" />
    </>
  ),
  upload: (
    <>
      <line x1="7" y1="2.5" x2="7" y2="9.5" />
      <path d="M4 5.5 L7 2.5 L10 5.5" />
      <line x1="2.5" y1="11.5" x2="11.5" y2="11.5" />
    </>
  ),
  // Archive: a lid over a box with a center pull-tab.
  archive: (
    <>
      <rect x="2" y="3" width="10" height="2.5" />
      <rect x="3" y="5.5" width="8" height="6" />
      <line x1="5.5" y1="8" x2="8.5" y2="8" />
    </>
  ),
  // Trash: bin body with a lid bar above and a handle.
  trash: (
    <>
      <line x1="2.5" y1="4" x2="11.5" y2="4" />
      <path d="M5.5 4 L5.5 2.5 L8.5 2.5 L8.5 4" />
      <path d="M3.5 4 L4.5 11.5 L9.5 11.5 L10.5 4" />
      <line x1="6" y1="6.5" x2="6" y2="10" />
      <line x1="8" y1="6.5" x2="8" y2="10" />
    </>
  ),
};
