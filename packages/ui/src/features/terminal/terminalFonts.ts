/**
 * Curated monospace families offered in the terminal font selector, plus a canvas-based
 * availability probe so the dropdown only lists fonts actually installed on this machine. Browsers
 * don't expose the installed-font list directly (privacy), so we measure a test string in each
 * candidate against generic fallbacks: if the width differs from every fallback, the candidate
 * resolved to a real face rather than silently falling back.
 */

/** Sentinel `value` for the "type a custom family" entry in the selector. */
export const CUSTOM_FONT_VALUE = "__custom__";

/** Well-known monospace fonts across macOS / Windows / Linux and popular developer installs. */
export const CURATED_MONO_FONTS: readonly string[] = [
  "JetBrains Mono",
  "Cascadia Code",
  "Cascadia Mono",
  "Fira Code",
  "Source Code Pro",
  "Hack",
  "IBM Plex Mono",
  "Roboto Mono",
  "SF Mono",
  "Menlo",
  "Monaco",
  "Consolas",
  "DejaVu Sans Mono",
  "Ubuntu Mono",
  "Courier New",
];

const PROBE_STRING = "mmmmmmmmmmlli1I...";
const PROBE_SIZE = "72px";
const BASE_FALLBACKS = ["monospace", "serif", "sans-serif"] as const;

/**
 * True when `family` resolves to an installed face. Compares the rendered width of `PROBE_STRING`
 * in `"family", <fallback>` against the bare `<fallback>` for each generic family — any difference
 * means the browser used the requested face.
 */
export function isFontAvailable(family: string): boolean {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const widthIn = (font: string): number => {
    ctx.font = font;
    return ctx.measureText(PROBE_STRING).width;
  };

  return BASE_FALLBACKS.some((base) => {
    const baseline = widthIn(`${PROBE_SIZE} ${base}`);
    const candidate = widthIn(`${PROBE_SIZE} "${family}", ${base}`);
    return candidate !== baseline;
  });
}

/** The curated families that are actually installed, preserving curated order. */
export function detectAvailableMonoFonts(): string[] {
  return CURATED_MONO_FONTS.filter(isFontAvailable);
}
