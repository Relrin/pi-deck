/**
 * DOM helpers that map a user text selection inside a plan card to/from stable character
 * offsets. The offset space is the card body's `textContent` (equivalently, the concatenation
 * of its descendant Text node data - which is exactly what `Range.toString()` yields), so a
 * comment captured once can be re-highlighted on any later render as long as the plan text is
 * unchanged. During the pending phase it is unchanged (the plan only changes on submit, which
 * clears comments), so the anchors stay valid.
 */

/** Nearest ancestor that is a plan card body (the offset/highlight root), or null. */
export function findPlanCardBody(node: Node | null): HTMLElement | null {
  if (!node) return null;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return (el?.closest("[data-plan-card-body]") as HTMLElement | null) ?? null;
}

/** Character length from the start of `root` to the (container, offset) boundary. */
function measureToBoundary(root: HTMLElement, container: Node, offset: number): number {
  const doc = root.ownerDocument;
  const probe = doc.createRange();
  probe.setStart(root, 0);
  probe.setEnd(container, offset);
  return probe.toString().length;
}

/**
 * Convert a live selection `Range` into `{ start, end }` offsets within `root`. Returns null
 * if the range escapes `root` or is empty/collapsed.
 */
export function rangeToOffsets(
  root: HTMLElement,
  range: Range,
): { start: number; end: number } | null {
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const start = measureToBoundary(root, range.startContainer, range.startOffset);
  const end = measureToBoundary(root, range.endContainer, range.endOffset);
  if (end <= start) return null;
  return { start, end };
}

/**
 * Rebuild a `Range` spanning `[start, end)` of `root`'s text — for painting a highlight or
 * measuring the selection's on-screen rect. Returns null if the offsets fall outside the
 * current text (e.g. the plan changed underneath a stale anchor).
 */
export function offsetsToRange(root: HTMLElement, start: number, end: number): Range | null {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let startNode: Text | undefined;
  let startOffset = 0;
  let endNode: Text | undefined;
  let endOffset = 0;
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const len = n.nodeValue?.length ?? 0;
    if (!startNode && start < acc + len) {
      startNode = n;
      startOffset = start - acc;
    }
    if (end <= acc + len) {
      endNode = n;
      endOffset = end - acc;
      break;
    }
    acc += len;
  }
  if (!startNode || !endNode) return null;
  const range = doc.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}
