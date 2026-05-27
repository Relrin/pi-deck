import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback } from "react";
import { useFileTreeStore, type VisibleRow } from "./useFileTreeStore.js";

interface UseFileTreeKeyboardArgs {
  projectId: string | undefined;
  visibleRows: VisibleRow[];
  onActivate?: (row: VisibleRow) => void;
  onRequestDelete: (paths: string[]) => void;
}

/**
 * Keyboard handler for the tree body — wire onto the outer `<div role="tree">`. Implements
 * the contract: ↑/↓/Home/End move focus, ←/→ collapse/expand or jump to
 * parent/first child, F2 renames, Delete trashes the selection, Enter selects (no editor
 * wiring in this plan), Esc cancels editing or clears the selection.
 */
export function useFileTreeKeyboard({
  projectId,
  visibleRows,
  onActivate,
  onRequestDelete,
}: UseFileTreeKeyboardArgs) {
  const store = useFileTreeStore();

  return useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!projectId) return;
      const tree = store.byProject[projectId];
      if (!tree) return;
      // Editing inline takes priority — let the input handle every key.
      if (tree.editing) return;

      const anchor = tree.selectionAnchor;
      const currentIndex = anchor ? visibleRows.findIndex((r) => r.path === anchor) : -1;

      const moveTo = (idx: number) => {
        const clamped = Math.max(0, Math.min(visibleRows.length - 1, idx));
        const row = visibleRows[clamped];
        if (!row) return;
        if (event.shiftKey && anchor) {
          store.selectRange(projectId, anchor, row.path);
        } else {
          store.selectOne(projectId, row.path);
        }
      };

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          moveTo(currentIndex < 0 ? 0 : currentIndex + 1);
          return;
        case "ArrowUp":
          event.preventDefault();
          moveTo(currentIndex < 0 ? visibleRows.length - 1 : currentIndex - 1);
          return;
        case "Home":
          event.preventDefault();
          moveTo(0);
          return;
        case "End":
          event.preventDefault();
          moveTo(visibleRows.length - 1);
          return;
        case "ArrowRight": {
          event.preventDefault();
          const row = visibleRows[currentIndex];
          if (!row) return;
          if (row.node.type === "dir" && !row.isExpanded) {
            store.setExpanded(projectId, row.path, true);
          } else if (row.node.type === "dir" && row.isExpanded) {
            // Already open — jump to the first child if any.
            const child = visibleRows[currentIndex + 1];
            if (child && child.depth > row.depth) {
              store.selectOne(projectId, child.path);
            }
          }
          return;
        }
        case "ArrowLeft": {
          event.preventDefault();
          const row = visibleRows[currentIndex];
          if (!row) return;
          if (row.node.type === "dir" && row.isExpanded) {
            store.setExpanded(projectId, row.path, false);
          } else {
            // Jump up to the parent dir row in the visible list.
            for (let i = currentIndex - 1; i >= 0; i--) {
              const candidate = visibleRows[i];
              if (candidate && candidate.depth < row.depth) {
                store.selectOne(projectId, candidate.path);
                break;
              }
            }
          }
          return;
        }
        case "F2": {
          event.preventDefault();
          const row = visibleRows[currentIndex];
          if (!row) return;
          store.beginRename(projectId, row.path);
          return;
        }
        case "Enter": {
          // No editor wiring in this plan — fire onActivate so callers can route in 013.
          // For directories, toggle expand instead so Enter behaves naturally.
          const row = visibleRows[currentIndex];
          if (!row) return;
          event.preventDefault();
          if (row.node.type === "dir") {
            store.toggleExpanded(projectId, row.path);
          } else if (onActivate) {
            onActivate(row);
          }
          return;
        }
        case "Delete":
        case "Backspace": {
          if (event.metaKey === false && event.key === "Backspace") {
            // Plain Backspace is a too-easy mis-key on a focused row; require Delete or
            // Cmd-Backspace (the macOS "delete" convention).
            return;
          }
          event.preventDefault();
          const targets = tree.selected.size > 0 ? [...tree.selected] : [];
          if (targets.length === 0) return;
          onRequestDelete(targets);
          return;
        }
        case "Escape":
          event.preventDefault();
          store.clearSelection(projectId);
          return;
        default:
          return;
      }
    },
    [projectId, store, visibleRows, onActivate, onRequestDelete],
  );
}
