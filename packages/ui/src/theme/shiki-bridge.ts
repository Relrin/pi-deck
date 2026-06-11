import { PI_DECK_SHIKI_THEME } from "./shiki-theme.js";

/**
 * Shiki receives one of:
 *   - the native pi-deck theme (CSS-variable colours that track the active theme live), or
 *   - a raw VS Code theme JSON it interprets directly.
 *
 * The bridge holds whichever payload matches the active pi-deck theme so syntax highlighting
 * tracks the UI palette.
 */

export type ShikiThemePayload = { name: string; raw?: unknown };

const NATIVE: ShikiThemePayload = { name: "pi-deck", raw: PI_DECK_SHIKI_THEME };

let active: ShikiThemePayload = NATIVE;

/** Returns the Shiki theme payload for the currently active pi-deck theme. */
export function getShikiThemeForActive(): ShikiThemePayload {
  return active;
}

/** Switch to the native var()-based theme. Called when no VS Code raw payload is available. */
export function setShikiThemeNative(): void {
  active = NATIVE;
}

/** Switch to a raw VS Code theme payload. The `name` is used as the cache key for the highlighter. */
export function setShikiThemeFromVSCode(raw: unknown): void {
  const name =
    typeof raw === "object" &&
    raw !== null &&
    "name" in raw &&
    typeof (raw as { name?: unknown }).name === "string"
      ? ((raw as { name: string }).name as string)
      : "vscode-imported";
  active = { name, raw };
}
