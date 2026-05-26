import { describe, expect, test } from "bun:test";
import { useRef } from "react";
import { render } from "../../test/utils";
import { useAutoGrowTextarea } from "./useAutoGrowTextarea";

/**
 * Test harness: renders a textarea and pipes its current value through the hook. Tests
 * stub `scrollHeight` and `getComputedStyle` so we don't rely on happy-dom's layout (it
 * doesn't run real layout, so scrollHeight defaults to 0).
 */
function Harness({
  value,
  scrollHeight,
  maxRows,
  lineHeight = 20,
  paddingTop = 8,
  paddingBottom = 8,
}: {
  value: string;
  scrollHeight: number;
  maxRows?: number;
  lineHeight?: number;
  paddingTop?: number;
  paddingBottom?: number;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  // Capture the element synchronously so we can patch scrollHeight + getComputedStyle
  // before the layout effect reads them.
  const setRef = (el: HTMLTextAreaElement | null) => {
    ref.current = el;
    if (el) {
      Object.defineProperty(el, "scrollHeight", {
        configurable: true,
        get: () => scrollHeight,
      });
      const originalGet = window.getComputedStyle;
      window.getComputedStyle = ((node: Element) => {
        if (node === el) {
          return {
            lineHeight: `${lineHeight}px`,
            paddingTop: `${paddingTop}px`,
            paddingBottom: `${paddingBottom}px`,
            borderTopWidth: "0px",
            borderBottomWidth: "0px",
          } as unknown as CSSStyleDeclaration;
        }
        return originalGet(node);
      }) as typeof window.getComputedStyle;
    }
  };
  useAutoGrowTextarea(ref, value, maxRows !== undefined ? { maxRows } : undefined);
  return <textarea ref={setRef} value={value} readOnly aria-label="Message" />;
}

describe("useAutoGrowTextarea", () => {
  test("sets the textarea height to fit content when below the max", () => {
    // 3 lines × 20px line-height + 16px padding = 76px scrollHeight, well under 10-row cap
    // of 216px (200 + 16). Expect height to track scrollHeight exactly.
    render(<Harness value="a\nb\nc" scrollHeight={76} />);
    const el = document.querySelector("textarea") as HTMLTextAreaElement;
    expect(el.style.height).toBe("76px");
    expect(el.style.overflowY).toBe("hidden");
  });

  test("clamps height to maxRows × lineHeight when content exceeds the cap", () => {
    // 15 lines worth: 15 × 20 + 16 = 316px scrollHeight. maxRows=10 → cap = 216px.
    render(<Harness value={"x\n".repeat(15)} scrollHeight={316} />);
    const el = document.querySelector("textarea") as HTMLTextAreaElement;
    expect(el.style.height).toBe("216px");
    // Past the cap → internal scrolling kicks in instead of the textarea continuing to grow.
    expect(el.style.overflowY).toBe("auto");
  });

  test("respects a custom maxRows", () => {
    render(<Harness value={"x\n".repeat(6)} scrollHeight={140} maxRows={5} />);
    // 5 rows × 20 + 16 padding = 116px cap; 140px scrollHeight exceeds it.
    const el = document.querySelector("textarea") as HTMLTextAreaElement;
    expect(el.style.height).toBe("116px");
    expect(el.style.overflowY).toBe("auto");
  });
});
