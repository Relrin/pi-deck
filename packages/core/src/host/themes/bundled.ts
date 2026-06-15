import type { ThemeSpec } from "../../protocol/theme.js";
import defaultLight from "./bundled/default-light.json";
import forge from "./bundled/forge.json";
import nightshadeLight from "./bundled/nightshade-light.json";
import obsidian from "./bundled/obsidian.json";

/**
 * The bundled pi-deck themes. These live in-memory only and are the authoritative source — they are
 * never written to the user themes dir. To fork one, a user saves a copy under a different name in
 * the themes dir (a disk file colliding with a bundled name is ignored; see `upsertUserEntry`).
 */
export const BUNDLED_THEMES: readonly ThemeSpec[] = [
  forge as ThemeSpec,
  obsidian as ThemeSpec,
  defaultLight as ThemeSpec,
  nightshadeLight as ThemeSpec,
];

export const BUNDLED_THEME_NAMES = BUNDLED_THEMES.map((t) => t.meta?.name ?? "unknown");
