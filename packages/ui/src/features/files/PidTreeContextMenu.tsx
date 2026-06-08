import type { ContextMenuItem, ContextMenuOpenContext } from "@pierre/trees";
import {
  ArrowLeftRight,
  FilePlus,
  FolderPlus,
  Paperclip,
  Pencil,
  Trash2,
} from "../../components/icons/index.js";

interface PidTreeContextMenuProps {
  /** The right-clicked row, supplied by `@pierre/trees`. */
  item: ContextMenuItem;
  /** Open context — used to close the menu after an action fires. */
  ctx: ContextMenuOpenContext;
  /** Present only for changed (added/modified) files — jumps to the Diff screen for the row. */
  onShowDiff?: (item: ContextMenuItem) => void;
  onNewFile: (item: ContextMenuItem) => void;
  onNewFolder: (item: ContextMenuItem) => void;
  onAttach: (item: ContextMenuItem) => void;
  onRename: (item: ContextMenuItem) => void;
  onDelete: (item: ContextMenuItem) => void;
}

/**
 * Row context-menu content rendered into Pierre's menu slot via `<FileTree renderContextMenu>`.
 */
export function PidTreeContextMenu({
  item,
  ctx,
  onShowDiff,
  onNewFile,
  onNewFolder,
  onAttach,
  onRename,
  onDelete,
}: PidTreeContextMenuProps) {
  const run = (fn: (item: ContextMenuItem) => void) => () => {
    fn(item);
    // Don't restore focus to the row — the action typically transfers focus elsewhere
    // (rename input) or pops a dialog.
    ctx.close({ restoreFocus: false });
  };

  return (
    <div className="pid-context-menu" role="menu">
      {onShowDiff ? (
        <>
          <button
            type="button"
            role="menuitem"
            className="pid-context-menu-item"
            onClick={run(onShowDiff)}
          >
            <span className="pid-context-menu-icon" aria-hidden>
              <ArrowLeftRight size={12} />
            </span>
            <span className="pid-context-menu-label">Show diff</span>
          </button>
          <div className="pid-context-menu-separator" aria-hidden />
        </>
      ) : null}
      <button
        type="button"
        role="menuitem"
        className="pid-context-menu-item"
        onClick={run(onNewFile)}
      >
        <span className="pid-context-menu-icon" aria-hidden>
          <FilePlus size={12} />
        </span>
        <span className="pid-context-menu-label">New file</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="pid-context-menu-item"
        onClick={run(onNewFolder)}
      >
        <span className="pid-context-menu-icon" aria-hidden>
          <FolderPlus size={12} />
        </span>
        <span className="pid-context-menu-label">New folder</span>
      </button>
      <div className="pid-context-menu-separator" aria-hidden />
      <button
        type="button"
        role="menuitem"
        className="pid-context-menu-item"
        onClick={run(onAttach)}
      >
        <span className="pid-context-menu-icon" aria-hidden>
          <Paperclip size={12} />
        </span>
        <span className="pid-context-menu-label">Attach to chat</span>
      </button>
      <div className="pid-context-menu-separator" aria-hidden />
      <button
        type="button"
        role="menuitem"
        className="pid-context-menu-item"
        onClick={run(onRename)}
      >
        <span className="pid-context-menu-icon" aria-hidden>
          <Pencil size={12} />
        </span>
        <span className="pid-context-menu-label">Rename…</span>
        <span className="pid-context-menu-shortcut">F2</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="pid-context-menu-item"
        data-danger
        onClick={run(onDelete)}
      >
        <span className="pid-context-menu-icon" aria-hidden>
          <Trash2 size={12} />
        </span>
        <span className="pid-context-menu-label">Move to Trash</span>
        <span className="pid-context-menu-shortcut">Del</span>
      </button>
    </div>
  );
}
