import type { ThemeSpec } from "../../protocol/theme.js";
import defaultDark from "./bundled/default-dark.json";
import defaultLight from "./bundled/default-light.json";
import nightshadeDark from "./bundled/nightshade-dark.json";
import nightshadeLight from "./bundled/nightshade-light.json";
import phosphorDark from "./bundled/phosphor-dark.json";
import phosphorLight from "./bundled/phosphor-light.json";

/**
 * The six bundled pi-deck themes. The host writes these to the user themes dir on first launch
 * as forkable examples, but always serves the in-memory copies here as the authoritative source —
 * a user editing one of the bundled JSONs on disk is intentional and treated like any other user
 * theme override.
 */
export const BUNDLED_THEMES: readonly ThemeSpec[] = [
  defaultDark as ThemeSpec,
  defaultLight as ThemeSpec,
  phosphorDark as ThemeSpec,
  phosphorLight as ThemeSpec,
  nightshadeDark as ThemeSpec,
  nightshadeLight as ThemeSpec,
];

export const BUNDLED_THEME_NAMES = BUNDLED_THEMES.map((t) => t.meta?.name ?? "unknown");
