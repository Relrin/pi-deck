import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const THEME = path.join(import.meta.dir, "..", "..", "src", "theme");

/**
 * Comments are stripped before any lookup. These rules are heavily commented — including with the
 * very selector one assertion below forbids — and matching against prose would make the test both
 * wrong and, when it failed, unreadable.
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

const components = stripComments(readFileSync(path.join(THEME, "components.css"), "utf8"));
const shell = stripComments(readFileSync(path.join(THEME, "shell.css"), "utf8"));
const tokens = stripComments(readFileSync(path.join(THEME, "tokens.css"), "utf8"));

/** The declarations inside the rule whose selector is `selector`, up to its closing brace. */
function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`rule not found: ${selector}`);
  const end = css.indexOf("}", start);
  return css.slice(start, end);
}

/**
 * A ratchet on the four rules that keep a long-label locale from clipping.
 *
 * Crude on purpose — it reads the stylesheet as text, because happy-dom has no layout engine and
 * cannot be asked whether anything actually overflows. What it buys is the thing a comment cannot:
 * someone tidying these selectors in six months gets a failing test naming the locale problem,
 * instead of a silently clipped Russian label nobody notices until a screenshot.
 */
describe("layout hardening for long labels", () => {
  test("segmented controls wrap instead of overflowing their card", () => {
    expect(ruleBody(components, ".pid-segmented")).toContain("flex-wrap: wrap");
  });

  test("chips are bounded and ellipsize", () => {
    const body = ruleBody(components, ".pid-chip");
    expect(body).toContain("max-width:");
    expect(body).toContain("text-overflow: ellipsis");
    expect(body).toContain("white-space: nowrap");
  });

  test("the screen switcher ellipsizes rather than growing the footer", () => {
    // Fixed-height footer chrome, so wrapping is not an option — the buttons shrink and fall back
    // to their `title`. `min-width: 0` on both container and button is what allows a flex item to
    // shrink below its content width at all; without it the other declarations do nothing.
    expect(ruleBody(shell, ".pid-screen-switcher")).toContain("min-width: 0");
    const button = ruleBody(shell, ".pid-screen-switcher button");
    expect(button).toContain("min-width: 0");
    expect(button).toContain("text-overflow: ellipsis");
  });

  test("the Cyrillic display-font remap is present and cannot outrank a font choice", () => {
    // Instrument Serif ships no Cyrillic, so `--font-display` has to fall back to `--font-ui`.
    // The selector must stay attribute-only: `:root[data-lang-script=…]` is (0,2,0) and would beat
    // `[data-fonts="mono-only"]` at (0,1,0) regardless of source order, silently overriding the
    // user's explicit font choice for every Russian user.
    expect(tokens.includes(`[data-lang-script="cyrillic"] {`)).toBe(true);
    expect(tokens.includes(`:root[data-lang-script=`)).toBe(false);
    expect(ruleBody(tokens, `[data-lang-script="cyrillic"]`)).toContain(
      "--font-display: var(--font-ui)",
    );
    // …and it must come *before* the font-pairing rules, so equal specificity resolves their way.
    expect(tokens.indexOf(`[data-lang-script="cyrillic"]`)).toBeLessThan(
      tokens.indexOf(`[data-fonts="sans-only"]`),
    );
  });
});
