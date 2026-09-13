/**
 * Strings for `features/files/`.
 *
 * File and directory *names* never appear here — they are data read from disk, and the tree sorts
 * them through `PATH_COLLATOR`, which is pinned to `"en"` on purpose (see AGENTS.md).
 */
const files = {
  confirmDeleteTitle: "Move {count:number} {{item|items}} to Trash?",
  moreItems: "+ {count:number} more {{item|items}}",
  confirmDeleteDescription: "Items can be restored from your operating system trash.",
  confirmDeleteBusy: "Moving…",
  confirmDelete: "Move to Trash",

  /** `PidFileTree.tsx`. Pierre owns the tree rows themselves — a documented English island. */
  tree: {
    label: "Project files",
  },

  /** `PidTreeSearch.tsx`. */
  search: {
    placeholder: "filter files…",
    label: "Filter files",
    clear: "Clear filter",
  },

  /**
   * `PidTreeContextMenu.tsx`. The `F2` / `Del` shortcut glyphs beside these are
   * `KeyboardEvent.key` names and are not copy.
   */
  menu: {
    showDiff: "Show diff",
    newFile: "New file",
    newFolder: "New folder",
    attachToChat: "Attach to chat",
    rename: "Rename…",
    moveToTrash: "Move to Trash",
  },

  /** `PidFileTreeEmptyState.tsx`. */
  empty: {
    noProject: "Open a project to browse its files.",
    emptyProject: "This project has no files yet.",
    noMatches: "No matches.",
    error: "Couldn’t load files.",
  },

  /**
   * Fallbacks passed to `humanizeError(err, …)`, used only when the host sent no recognisable
   * error code and no message of its own.
   */
  errors: {
    create: "Failed to create item",
    rename: "Failed to rename",
    move: "Failed to move",
    trash: "Failed to move to trash",
    load: "Failed to load project files",
  },
} as const;

export default files;
