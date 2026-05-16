import { createHighlighter, type Highlighter } from "shiki";
import { getShikiThemeForActive, type ShikiThemePayload } from "../../../theme/shiki-bridge.js";

/**
 * Memoized Shiki highlighter, shared across every CodeBlock instance.
 *
 * One highlighter per active theme (keyed by `payload.raw` if VS Code-derived, else `payload.name`).
 * Switching themes constructs a new highlighter; the old one is dropped on GC. Languages loaded
 * for the previous theme are forgotten — they're re-loaded lazily as code blocks render.
 */

const BASE_LANGS = ["bash", "sh", "json", "ts", "tsx", "js", "jsx", "md", "yaml", "toml"] as const;

interface HighlighterEntry {
  promise: Promise<Highlighter>;
  loadedLangs: Set<string>;
  themeName: string;
}

let current: HighlighterEntry | undefined;

function keyOf(payload: ShikiThemePayload): unknown {
  return payload.raw ?? payload.name;
}

function buildHighlighter(payload: ShikiThemePayload): HighlighterEntry {
  const theme = payload.raw
    ? (payload.raw as Parameters<typeof createHighlighter>[0]["themes"][number])
    : payload.name;
  return {
    promise: createHighlighter({ themes: [theme], langs: [...BASE_LANGS] }),
    loadedLangs: new Set<string>(BASE_LANGS),
    themeName: payload.name,
  };
}

let lastKey: unknown;
function getEntry(): HighlighterEntry {
  const payload = getShikiThemeForActive();
  const key = keyOf(payload);
  if (!current || key !== lastKey) {
    current = buildHighlighter(payload);
    lastKey = key;
  }
  return current;
}

/** Drop the cached highlighter so the next render picks up the new active theme. */
export function resetHighlighter(): void {
  current = undefined;
  lastKey = undefined;
}

export interface HighlightOptions {
  code: string;
  lang: string;
}

/**
 * Highlight `code` for `lang`, falling back to a plain (unstyled) HTML wrap on any failure.
 * Always returns sanitised HTML safe to pass to `dangerouslySetInnerHTML`.
 */
export async function highlight({ code, lang }: HighlightOptions): Promise<string> {
  const entry = getEntry();
  const hl = await entry.promise;
  const requested = lang || "text";
  if (!entry.loadedLangs.has(requested)) {
    try {
      await hl.loadLanguage(requested as Parameters<Highlighter["loadLanguage"]>[0]);
      entry.loadedLangs.add(requested);
    } catch {
      // Unknown language — fall through to the default "text" path.
    }
  }
  try {
    return hl.codeToHtml(code, {
      lang: entry.loadedLangs.has(requested) ? requested : "text",
      theme: entry.themeName,
    });
  } catch {
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
