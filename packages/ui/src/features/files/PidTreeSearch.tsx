import type { FileTree as FileTreeModel } from "@pierre/trees";
import { useFileTreeSearch } from "@pierre/trees/react";
import type { KeyboardEvent } from "react";
import { Search, X } from "../../components/icons/index.js";

interface PidTreeSearchProps {
  /** The `@pierre/trees` model from `useFileTree`. */
  model: FileTreeModel;
}

/**
 * Left-tab filter, backed by `@pierre/trees`' built-in search engine (replacing the old
 * `fuse.js` filter). The input is controlled off the model's live search value via
 * `useFileTreeSearch`; typing calls `setValue`, which filters the visible rows in-memory —
 * no debounce needed since there's no index to rebuild per keystroke.
 *
 * Isolated into its own component so per-keystroke search updates re-render only the input,
 * not the whole tree shell.
 */
export function PidTreeSearch({ model }: PidTreeSearchProps) {
  const search = useFileTreeSearch(model);
  const value = search.value;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && value.length > 0) {
      e.preventDefault();
      search.setValue(null);
      return;
    }
    if (e.key === "ArrowDown") {
      // Hand keyboard control to the tree: focusing the first match moves into Pierre's
      // built-in navigation. With no active query there's no match to land on, so we leave
      // focus on the input (the user can click or Tab into the tree).
      if (search.matchingPaths.length > 0) {
        e.preventDefault();
        search.focusNextMatch();
      }
    }
  };

  return (
    <div className="pid-tree-filter">
      <span className="pid-tree-filter-icon" aria-hidden>
        <Search size={12} />
      </span>
      <input
        type="text"
        className="pid-input pid-tree-filter-input"
        placeholder="filter files…"
        value={value}
        onChange={(e) => search.setValue(e.target.value || null)}
        onKeyDown={handleKeyDown}
        aria-label="Filter files"
      />
      {value.length > 0 && (
        <button
          type="button"
          className="pid-tree-filter-clear"
          onClick={() => search.setValue(null)}
          aria-label="Clear filter"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}
