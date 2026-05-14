/**
 * Centralised UI tuning knobs. Anything tweaked by a designer / product call goes here so
 * we don't hunt them down across the tree. Pure values only — no React, no DOM.
 */

/** Lines before a `CodeBlock` collapses with a "show full output" toggle. */
export const CODE_BLOCK_COLLAPSED_LINES = 40;

/** Max-height (rem) of a `CodeBlock`'s scroll container when expanded. */
export const CODE_BLOCK_MAX_HEIGHT_REM = 28;

/** Max-height (rem) of the DefaultRenderer section containers. */
export const DEFAULT_RENDERER_SECTION_MAX_HEIGHT_REM = 24;

/** Distance from list bottom (px) under which `MessageList` keeps sticking to the bottom. */
export const MESSAGE_LIST_STICKY_THRESHOLD_PX = 80;

/** Rough estimate of one virtualised message item; the virtualizer remeasures from the DOM. */
export const MESSAGE_LIST_ESTIMATE_PX = 120;

/** How long (ms) a freshly running tool card flashes a highlight ring. */
export const TOOL_CARD_HIGHLIGHT_MS = 1500;

/** Window-width breakpoint (px) below which the sessions sidebar becomes a drawer. */
export const RESPONSIVE_BREAKPOINT_PX = 900;

/** Truncate-middle target length for summary chips/labels. */
export const SUMMARY_TRUNCATE_MAX = 60;

/** Time window (ms) used by `useMessagesStore` to dedup near-duplicate user messages. */
export const USER_MESSAGE_DEDUP_WINDOW_MS = 10_000;

/** Toast auto-dismiss timeout (ms). */
export const TOAST_DISMISS_MS = 8_000;

/** Max number of edits shown before EditRenderer collapses with a "show all N edits" toggle. */
export const EDIT_RENDERER_COLLAPSED_EDITS = 3;
