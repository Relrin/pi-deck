import { Fragment, type ReactNode } from "react";

/**
 * Splicing React nodes into an already-translated sentence.
 *
 * Several hints interleave an inline `<PidKbd>` with prose — `Esc to close`,
 * `↵ send · ⇧↵ new line`. Splitting those into `hint.before` / `hint.after` fragment keys would
 * preserve the English byte for byte and still be wrong: it hard-codes where the key glyph sits,
 * and Russian wants it elsewhere ("Закрыть — Esc"). So the catalog holds the *whole* sentence with
 * named slots and the component hands `rich()` the nodes to drop into them.
 */

/**
 * The slot delimiter.
 *
 * U+0000 cannot occur in copy and renders as nothing if one ever escaped, so a missed slot degrades
 * to an invisible gap rather than to visible garbage.
 */
const MARK = "\u0000";

/**
 * The value to pass as a slot argument: `LL.settings.hint({ esc: slot("esc") })`.
 *
 * Deliberately whitespace-free. typesafe-i18n **trims interpolated argument values** (see the note
 * on `chat.review.turnSuffix` in `en/chat.ts`), so a separator smuggled in through an argument
 * arrives mangled — every space in these sentences must live in the catalog template.
 */
export const slot = (name: string): string => `${MARK}${name}${MARK}`;

/**
 * Split a localized string on its slots and substitute the matching nodes.
 *
 * Odd-indexed chunks are slot names because the delimiter always comes in pairs; even-indexed
 * chunks are literal text. The generator makes each slot a required argument, so a forgotten
 * `slot()` is a type error rather than an empty string — the DEV throw below only catches the
 * narrower mistake of passing the argument but not the node.
 */
export function rich(text: string, nodes: Record<string, ReactNode>): ReactNode[] {
  return text.split(MARK).map((chunk, i) => {
    if (i % 2 === 0) return chunk;
    if (import.meta.env?.DEV && !(chunk in nodes)) {
      throw new Error(`rich(): no node supplied for slot "${chunk}"`);
    }
    // biome-ignore lint/suspicious/noArrayIndexKey: chunks are positional slices of one fixed string
    return <Fragment key={`${chunk}-${i}`}>{nodes[chunk]}</Fragment>;
  });
}
