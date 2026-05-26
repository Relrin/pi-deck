import { type RefObject, useLayoutEffect } from "react";

interface AutoGrowOptions {
  /**
   * Maximum number of text rows the textarea is allowed to expand to before it switches
   * to internal scrolling. Defaults to 10 rows — long enough to accept multi-paragraph
   * prompts without overwhelming the composer chrome.
   */
  maxRows?: number;
}

/**
 * Resizes a textarea to fit its content, capped at `maxRows` lines. When the content
 * exceeds the cap, the element grows to the cap and starts scrolling internally. CSS
 * `min-height` still wins as the lower bound so an empty textarea keeps its baseline.
 *
 * Why a layout effect: we set `height = "auto"` first so `scrollHeight` reflects the
 * *current* wrap (not the previous one), then write the clamped height back. Doing this in
 * a passive effect would briefly paint at the wrong size between renders.
 */
export function useAutoGrowTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  options: AutoGrowOptions = {},
): void {
  const maxRows = options.maxRows ?? 10;
  useLayoutEffect(() => {
    // `value` is a signal-only dependency — the actual text is read off the textarea, but
    // we still need to re-measure on every content change. Touching it here both makes the
    // intent explicit and satisfies the exhaustive-deps check.
    void value;
    const el = ref.current;
    if (!el) return;
    // Reset to natural height so the browser recomputes `scrollHeight` against the new
    // content. Without this, a deletion would leave scrollHeight stuck at the old larger
    // value.
    el.style.height = "auto";
    const styles = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 0;
    const paddingY =
      Number.parseFloat(styles.paddingTop || "0") + Number.parseFloat(styles.paddingBottom || "0");
    const borderY =
      Number.parseFloat(styles.borderTopWidth || "0") +
      Number.parseFloat(styles.borderBottomWidth || "0");
    const maxPx = lineHeight * maxRows + paddingY + borderY;
    // scrollHeight already excludes the border; add it back to get the box height we want
    // to assign via style.height (which is content + padding + border under box-sizing:
    // border-box, our default).
    const desired = el.scrollHeight + borderY;
    const next = Math.min(maxPx, desired);
    el.style.height = `${next}px`;
    el.style.overflowY = desired > maxPx ? "auto" : "hidden";
  }, [ref, value, maxRows]);
}
