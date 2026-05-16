import type { ThemeKind } from "@pi-deck/core";

/**
 * Shiki receives one of:
 *   - a bundled theme name string (e.g. "github-dark-default"), or
 *   - a raw VS Code theme JSON it interprets directly.
 *
 * The bridge holds whichever payload matches the active pi-deck theme so syntax highlighting
 * tracks the UI palette.
 */

export type ShikiThemePayload = { name: string; raw?: unknown };

let active: ShikiThemePayload = { name: "github-dark-default" };

/** Returns the Shiki theme payload for the currently active pi-deck theme. */
export function getShikiThemeForActive(): ShikiThemePayload {
  return active;
}

/** Switch to a bundled Shiki theme by kind. Called when no VS Code raw payload is available. */
export function setShikiThemeByKind(kind: ThemeKind): void {
  active = { name: kind === "light" ? "github-light-default" : "github-dark-default" };
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
