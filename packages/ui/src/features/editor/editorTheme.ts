import { HighlightStyle } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { COMPLETION_ICONS, completionIconMaskUrl } from "./codicon-symbols.js";

/**
 * CodeMirror chrome theme + syntax highlight style, both expressed against pi-deck's CSS custom
 * properties (`packages/ui/src/theme/tokens.css`).
 *
 * Token → tag mapping follows the design mockup (`.pid-code .kw/.str/.com/.typ/.fn/.num`):
 *   keyword → accent · string → add · comment → ink-3 (italic) · type/class → info ·
 *   function → mod · number/atom → del.
 */
export function cmTheme(dark: boolean): Extension {
  return EditorView.theme(
    {
      "&": {
        color: "var(--ink-1)",
        backgroundColor: "var(--bg-0)",
        height: "100%",
        fontSize: "var(--t-13, 13px)",
      },
      ".cm-scroller": {
        fontFamily: "var(--font-mono)",
        lineHeight: "1.6",
      },
      ".cm-content": {
        caretColor: "var(--accent)",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "var(--accent)",
      },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: "var(--accent-soft)",
      },
      ".cm-gutters": {
        backgroundColor: "var(--bg-0)",
        color: "var(--ink-3)",
        border: "none",
        fontVariantNumeric: "tabular-nums",
      },
      ".cm-activeLine": {
        backgroundColor: "color-mix(in srgb, var(--bg-2) 45%, transparent)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "color-mix(in srgb, var(--bg-2) 45%, transparent)",
        color: "var(--ink-1)",
      },
      ".cm-foldPlaceholder": {
        backgroundColor: "var(--bg-2)",
        color: "var(--ink-2)",
        border: "1px solid var(--line)",
      },
      ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
        backgroundColor: "var(--accent-soft)",
        outline: "1px solid var(--accent-line)",
      },
      ".cm-selectionMatch": {
        backgroundColor: "var(--warn-soft)",
      },
      ".cm-searchMatch": {
        backgroundColor: "var(--warn-soft)",
        outline: "1px solid var(--warn)",
      },
      ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: "var(--accent-soft)",
      },
      ".cm-panels": {
        backgroundColor: "var(--bg-1)",
        color: "var(--ink-1)",
        borderColor: "var(--line)",
      },
      ".cm-panel input, .cm-panel button": {
        fontFamily: "var(--font-mono)",
      },
      ".cm-tooltip": {
        backgroundColor: "var(--bg-2)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius, 6px)",
        color: "var(--ink-1)",
        boxShadow: "var(--shadow-pop)",
      },
      ".cm-tooltip.cm-tooltip-autocomplete > ul": {
        minWidth: "320px",
        maxWidth: "min(700px, 90vw)",
        maxHeight: "22em",
      },
      ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
        padding: "4px 8px",
        lineHeight: "1.4",
      },
      ".cm-tooltip-autocomplete ul li": {
        fontFamily: "var(--font-mono)",
      },
      ".cm-tooltip-autocomplete ul li[aria-selected]": {
        backgroundColor: "var(--accent-soft)",
        color: "var(--accent)",
      },
      // Docs panel beside the completion list.
      ".cm-tooltip.cm-completionInfo": {
        maxWidth: "min(480px, 70vw)",
        maxHeight: "22em",
        overflowY: "auto",
        padding: "6px 10px",
      },
      ".cm-completionLabel": { color: "var(--ink-1)" },
      ".cm-completionDetail": { color: "var(--ink-3)" },
      ".cm-completionIcon": {
        width: "1.1em",
        paddingRight: ".5em",
        fontStyle: "normal",
        fontSize: "85%",
        textAlign: "center",
        opacity: "0.9",
      },
      ".cm-completionIcon:after": { content: "'·'", color: "var(--ink-3)" },
      ...COMPLETION_ICON_RULES,
    },
    { dark },
  );
}

/**
 * One rule per completion kind: an empty pseudo-element sized to the row, with the codicon
 * as a mask over a token-coloured background
 */
const COMPLETION_ICON_RULES: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(COMPLETION_ICONS).map(([type, icon]) => [
    `.cm-completionIcon-${type}:after`,
    {
      content: "''",
      display: "inline-block",
      width: "1em",
      height: "1em",
      verticalAlign: "text-bottom",
      backgroundColor: `var(${icon.token})`,
      mask: `${completionIconMaskUrl(icon)} center / contain no-repeat`,
    },
  ]),
);

const highlight = HighlightStyle.define([
  {
    tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword],
    color: "var(--accent)",
  },
  { tag: [t.definitionKeyword, t.modifier, t.self], color: "var(--accent)" },
  { tag: [t.string, t.special(t.string), t.regexp, t.character], color: "var(--add)" },
  {
    tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
    color: "var(--ink-3)",
    fontStyle: "italic",
  },
  { tag: [t.typeName, t.className, t.namespace, t.tagName], color: "var(--info)" },
  {
    tag: [
      t.function(t.variableName),
      t.function(t.definition(t.variableName)),
      t.labelName,
      t.macroName,
    ],
    color: "var(--mod)",
  },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--del)" },
  { tag: [t.propertyName, t.attributeName], color: "var(--ink-1)" },
  { tag: [t.variableName, t.definition(t.variableName)], color: "var(--ink-1)" },
  { tag: [t.operator, t.punctuation, t.bracket, t.separator], color: "var(--ink-2)" },
  { tag: [t.meta, t.annotation, t.processingInstruction], color: "var(--info)" },
  { tag: [t.heading], color: "var(--ink-0)", fontWeight: "600" },
  { tag: [t.strong], fontWeight: "600" },
  { tag: [t.emphasis], fontStyle: "italic" },
  { tag: [t.link, t.url], color: "var(--accent)", textDecoration: "underline" },
  { tag: [t.invalid], color: "var(--del)" },
]);

/** The shared syntax `HighlightStyle`. Colours are CSS vars, so it tracks the active theme. */
export function cmHighlight(): HighlightStyle {
  return highlight;
}
