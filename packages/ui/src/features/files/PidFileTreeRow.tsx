import { Icon } from "@iconify/react";
import type { CSSProperties, DragEvent, MouseEvent } from "react";
import { memo, useEffect, useRef } from "react";
import { iconForFile } from "../../components/icons/file-icons.js";
import { ChevronDown, ChevronRight, Folder, FolderOpen } from "../../components/icons/index.js";
import { PIDECK_PATHS_MIME } from "./dragDrop.js";
import type { VisibleRow } from "./useFileTreeStore.js";

export type RowStatusTone = "add" | "mod" | "del" | "unt";

interface PidFileTreeRowProps {
  projectId: string;
  row: VisibleRow;
  /** Resolved git status badge for this absolute path, if any. */
  statusBadge?: { letter: "A" | "M" | "D" | "?"; tone: RowStatusTone };
  isSelected: boolean;
  /** Editing state — when present, the label becomes an `<input>`. */
  editingInitialValue?: string;
  onSelect: (event: MouseEvent<HTMLDivElement>, row: VisibleRow) => void;
  onToggleExpand: (row: VisibleRow) => void;
  onContextMenu: (event: MouseEvent<HTMLDivElement>, row: VisibleRow) => void;
  /** Called when the user commits the inline edit (Enter on the input). */
  onCommitEdit: (value: string) => void;
  onCancelEdit: () => void;
  /** Called when the user starts dragging this row. */
  onDragStart: (event: DragEvent<HTMLDivElement>, row: VisibleRow) => void;
  /** Inline style for virtualization positioning. */
  style?: CSSProperties;
}

const INDENT_PX = 14;
const BASE_PX = 14;

/**
 * `React.memo` here is load-bearing: PidFileTree renders ~20 virtualized rows, and a
 * selection click that doesn't change a row's visible state should skip its render.
 * Props are shallow-comparable (callbacks are useCallback-stable, the `row` reference
 * only changes when the underlying node changes via the watcher).
 */
export const PidFileTreeRow = memo(function PidFileTreeRow({
  row,
  statusBadge,
  isSelected,
  editingInitialValue,
  onSelect,
  onToggleExpand,
  onContextMenu,
  onCommitEdit,
  onCancelEdit,
  onDragStart,
  style,
}: PidFileTreeRowProps) {
  const isDir = row.node.type === "dir";
  const padLeft = BASE_PX + row.depth * INDENT_PX;
  const isEditing = editingInitialValue !== undefined;

  // Whole row is the click target: chevron, icon, and label all share
  // the same activation surface.
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (isEditing) return;
    if (isDir && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      onToggleExpand(row);
    }
    onSelect(e, row);
  };

  return (
    /* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard nav (arrows / F2 / Del /
       Enter) is handled on the parent `<div role="tree">` via useFileTreeKeyboard — rows
       don't duplicate it. */
    <div
      className="pid-tree-row"
      data-selected={isSelected || undefined}
      data-depth={row.depth}
      role="treeitem"
      // `treeitem` rows are conventionally roving-tabindex; the container `<div role="tree">`
      // owns keyboard focus and forwards arrow-key events to update the active row. We mark
      // the selected row tabbable so screen readers can land on it explicitly when needed.
      tabIndex={isSelected ? 0 : -1}
      aria-level={row.depth + 1}
      aria-selected={isSelected}
      aria-expanded={isDir ? row.isExpanded : undefined}
      style={{ paddingLeft: padLeft, ...style }}
      draggable={!isEditing}
      onClick={handleClick}
      onDragStart={(e) => onDragStart(e, row)}
      onContextMenu={(e) => onContextMenu(e, row)}
    >
      <span className="pid-tree-row-arrow" aria-hidden>
        {isDir ? row.isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} /> : null}
      </span>
      <span className="pid-tree-row-icon" aria-hidden>
        {isDir ? (
          row.isExpanded ? (
            <FolderOpen size={14} />
          ) : (
            <Folder size={14} />
          )
        ) : (
          <Icon icon={iconForFile(row.node.name)} width={14} height={14} />
        )}
      </span>
      {isEditing ? (
        <InlineEditInput
          initialValue={editingInitialValue}
          onCommit={onCommitEdit}
          onCancel={onCancelEdit}
        />
      ) : (
        <span className="pid-tree-row-name" title={row.path}>
          {row.node.name}
        </span>
      )}
      {statusBadge && !isEditing && (
        <span
          className="pid-tree-row-badge"
          data-tone={statusBadge.tone}
          title={badgeLabel(statusBadge.letter)}
        >
          {statusBadge.letter}
        </span>
      )}
    </div>
  );
});

function badgeLabel(letter: "A" | "M" | "D" | "?"): string {
  if (letter === "A") return "Added";
  if (letter === "M") return "Modified";
  if (letter === "D") return "Deleted";
  return "Untracked";
}

interface InlineEditInputProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

function InlineEditInput({ initialValue, onCommit, onCancel }: InlineEditInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  // Tracks whether the user explicitly cancelled (Escape) so the trailing `onBlur` fired by
  // React unmounting the input doesn't accidentally call `onCommit`. Without this guard the
  // sequence is: Escape → onCancel → editing state cleared → React unmounts the input → blur
  // fires → "value !== initialValue" branch triggers commit → unwanted rename.
  const cancelledRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Defer past the current paint so Radix's context-menu close (which can briefly steal
    // focus despite `onCloseAutoFocus={e => e.preventDefault()}` on certain interaction
    // paths) doesn't undo our focus. rAF guarantees we run after the menu has unmounted.
    const id = requestAnimationFrame(() => {
      el.focus();
      // Select the basename (everything before the last `.`) so extension stays intact when
      // renaming `foo.ts` → `bar.ts`. Drafts (empty initialValue) put the caret at start.
      if (initialValue.length > 0) {
        const dot = initialValue.lastIndexOf(".");
        const end = dot > 0 ? dot : initialValue.length;
        el.setSelectionRange(0, end);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [initialValue]);

  return (
    <input
      ref={ref}
      defaultValue={initialValue}
      className="pid-tree-row-input"
      aria-label="Filename"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(e.currentTarget.value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancelledRef.current = true;
          onCancel();
        }
      }}
      onBlur={(e) => {
        // Esc-cancelled: the blur that fires when React unmounts the input must NOT commit,
        // otherwise pressing Escape after typing would still rename the file.
        if (cancelledRef.current) return;
        // Click-away with no change → treat as cancel; click-away after editing → commit.
        if (e.currentTarget.value === initialValue) {
          onCancel();
        } else {
          onCommit(e.currentTarget.value);
        }
      }}
    />
  );
}

// Re-exported so call sites don't have to grab it from dragDrop directly. The actual
// payload builder lives in dragDrop.ts to keep this file React-only (HMR Fast Refresh
// rejects mixed component/util exports).
export { PIDECK_PATHS_MIME };
