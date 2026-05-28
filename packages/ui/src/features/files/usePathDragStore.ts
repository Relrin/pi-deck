import { create } from "zustand";

interface PathDragStore {
  /** True while a file-tree → composer drag is in flight. Subscribed by the chat view and
   * composer surfaces to render their "ready to attach" affordance. */
  isDragging: boolean;
  /**
   * Mark a drag as begun. Idempotent — calling it twice in a row stays at `isDragging=true`.
   * Wires up a one-shot document-level cleanup so the flag clears no matter how the drag
   * ends (drop on us, drop outside the app, Escape, lost focus).
   */
  begin: () => void;
  /** Force-clear the flag. Intended for tests + defensive use; the document listeners
   * registered by `begin` cover the normal lifecycle. */
  end: () => void;
}

/**
 * Single-flag drag affordance store. The file-tree row's `onDragStart` calls `begin()`; from
 * that moment until the drag ends (anywhere in the document), surfaces that want to advertise
 * themselves as drop targets — the chat history, the composer shell — read `isDragging` and
 * paint a soft accent on themselves.
 *
 * We listen on the document rather than per-row `onDragEnd` because the React-virtual
 * scroller can recycle the source row mid-drag if the user scrolls, which would skip the
 * row's own `dragend` handler. Document-level capture-phase listeners catch every termination.
 */
export const usePathDragStore = create<PathDragStore>((set, get) => ({
  isDragging: false,
  begin: () => {
    if (get().isDragging) return;
    set({ isDragging: true });
    if (typeof document === "undefined") return;
    const cleanup = () => {
      set({ isDragging: false });
      document.removeEventListener("dragend", cleanup, true);
      document.removeEventListener("drop", cleanup, true);
      window.removeEventListener("blur", cleanup);
    };
    document.addEventListener("dragend", cleanup, true);
    document.addEventListener("drop", cleanup, true);
    // Window blur (Cmd-Tab to another app) effectively ends the drag from our perspective —
    // no further dragend will fire. Clearing here keeps the highlight from getting stuck.
    window.addEventListener("blur", cleanup);
  },
  end: () => set({ isDragging: false }),
}));
