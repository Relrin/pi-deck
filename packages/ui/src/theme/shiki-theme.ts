import type { ThemeRegistration } from "shiki";

/**
 * Hand-authored Shiki theme whose colours are literal `var(--syn-*)` references.
 * Shiki copies foreground strings verbatim into inline `style` attributes (the same mechanism
 * as its own `createCssVariablesTheme`), so highlighted HTML tracks the active pi-deck theme
 * live — no re-highlight needed on theme switch.
 *
 * Scope → token mapping mirrors the lezer-tag mapping in `features/editor/editorTheme.ts`;
 * TextMate resolution picks the most specific matching selector, so generic rules
 * (`variable`, `punctuation`) are safely shadowed by deeper ones (`variable.parameter`,
 * `punctuation.definition.string`).
 *
 * `fontStyle` cannot carry a CSS var (Shiki parses it into a TextMate bitmask), so comment
 * italics are static here; imported VS Code themes bypass this theme entirely via raw
 * passthrough and keep their exact styles.
 */
export const PI_DECK_SHIKI_THEME: ThemeRegistration = {
  name: "pi-deck",
  type: "dark", // nominal — every colour is a CSS variable that follows the active theme
  colors: {
    "editor.background": "var(--code-bg)",
    "editor.foreground": "var(--ink-1)",
  },
  tokenColors: [
    { scope: ["variable"], settings: { foreground: "var(--syn-variable)" } },
    { scope: ["punctuation", "meta.brace"], settings: { foreground: "var(--syn-punctuation)" } },
    {
      scope: ["keyword", "storage.modifier", "storage.type", "variable.language"],
      settings: { foreground: "var(--syn-keyword)" },
    },
    {
      scope: ["string", "punctuation.definition.string"],
      settings: { foreground: "var(--syn-string)" },
    },
    {
      scope: ["string.regexp", "constant.character.escape"],
      settings: { foreground: "var(--syn-regexp)" },
    },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "var(--syn-comment)", fontStyle: "italic" },
    },
    {
      scope: ["comment.block.documentation"],
      settings: { foreground: "var(--syn-doc-comment)", fontStyle: "italic" },
    },
    { scope: ["constant.numeric"], settings: { foreground: "var(--syn-number)" } },
    {
      scope: ["constant.language", "support.constant", "variable.other.constant"],
      settings: { foreground: "var(--syn-constant)" },
    },
    {
      scope: ["entity.name.type", "support.type", "entity.other.inherited-class"],
      settings: { foreground: "var(--syn-type)" },
    },
    {
      scope: ["entity.name.class", "support.class"],
      settings: { foreground: "var(--syn-class)" },
    },
    {
      scope: ["entity.name.function", "support.function"],
      settings: { foreground: "var(--syn-function)" },
    },
    {
      scope: ["entity.name.function.macro", "entity.name.label"],
      settings: { foreground: "var(--syn-macro)" },
    },
    { scope: ["variable.parameter"], settings: { foreground: "var(--syn-parameter)" } },
    {
      scope: ["variable.other.property", "support.type.property-name", "meta.object-literal.key"],
      settings: { foreground: "var(--syn-property)" },
    },
    { scope: ["entity.other.attribute-name"], settings: { foreground: "var(--syn-attribute)" } },
    { scope: ["entity.name.tag"], settings: { foreground: "var(--syn-tag)" } },
    { scope: ["keyword.operator"], settings: { foreground: "var(--syn-operator)" } },
    {
      scope: ["meta.preprocessor", "storage.type.annotation", "entity.name.function.decorator"],
      settings: { foreground: "var(--syn-meta)" },
    },
    {
      scope: ["markup.underline.link", "string.other.link"],
      settings: { foreground: "var(--syn-link)" },
    },
    {
      scope: ["markup.heading", "entity.name.section"],
      settings: { foreground: "var(--syn-heading)", fontStyle: "bold" },
    },
    { scope: ["markup.bold"], settings: { fontStyle: "bold" } },
    { scope: ["markup.italic"], settings: { fontStyle: "italic" } },
    { scope: ["markup.inserted"], settings: { foreground: "var(--add)" } },
    { scope: ["markup.deleted"], settings: { foreground: "var(--del)" } },
    { scope: ["invalid"], settings: { foreground: "var(--syn-invalid)" } },
  ],
};
