import { createHighlighter, type Highlighter } from "shiki";

/**
 * Memoized Shiki highlighter, shared across every CodeBlock instance.
 *
 * Without this, each `<CodeBlock>` independently awaited `codeToHtml`, which under the hood
 * spun up its own highlighter + reloaded language grammars on first use — visible as code
 * "popping in" while the user scrolls. Reusing one highlighter means subsequent fences
 * highlight effectively synchronously.
 */

const THEME = "github-dark-default";
const BASE_LANGS = ["bash", "sh", "json", "ts", "tsx", "js", "jsx", "md", "yaml", "toml"] as const;

let highlighterPromise: Promise<Highlighter> | undefined;
const loadedLangs = new Set<string>(BASE_LANGS);

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({ themes: [THEME], langs: [...BASE_LANGS] });
  }
  return highlighterPromise;
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
  const hl = await getHighlighter();
  const requested = lang || "text";
  if (!loadedLangs.has(requested)) {
    try {
      await hl.loadLanguage(requested as Parameters<Highlighter["loadLanguage"]>[0]);
      loadedLangs.add(requested);
    } catch {
      // Unknown language — fall through to the default "text" path.
    }
  }
  try {
    return hl.codeToHtml(code, {
      lang: loadedLangs.has(requested) ? requested : "text",
      theme: THEME,
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
