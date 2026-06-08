import type { GitChange } from "@pi-deck/core/git/types.js";
import type { MouseEvent } from "react";
import { FileText, Undo2 } from "../../components/icons/index.js";
import { PidPierreFileIcon } from "../../components/icons/PidPierreFileIcon.js";
import { ContextMenu, type ContextMenuItem } from "../../components/ui/ContextMenu.js";

interface Props {
  change: GitChange;
  /** True when the active session's agent has written to this path. */
  touched?: boolean;
  /** Checkbox state — staging intent only, no actual git side-effect in v1. */
  selected: boolean;
  /** Highlights the row (accent background + left border) like the screenshot's first row. */
  active: boolean;
  onToggle: () => void;
  /** Single-click handler: highlight the row, no navigation. */
  onSelect: () => void;
  /** Double-click handler: route to the diff screen for this file. */
  onOpenDiff: () => void;
  /** Right-click action: open this file in the editor. Omitted for deleted files (no file on
   * disk to open). */
  onShowInEditor?: () => void;
  /** Right-click action: discard this file's changes — restore to HEAD, or remove it if
   * untracked. Applies to every change (including deletions, which it restores). */
  onRollback?: () => void;
  /** Suppress the parent-directory suffix on the filename — used in folder grouping where
   * the dir already appears in the section header above. */
  hidePathDir?: boolean;
}

const STATUS_TONE: Record<GitChange["status"], "add" | "mod" | "del" | "ren" | "unt"> = {
  A: "add",
  M: "mod",
  R: "ren",
  C: "mod",
  D: "del",
  U: "mod",
  "?": "unt",
};

const STATUS_LABEL: Record<GitChange["status"], string> = {
  A: "A",
  M: "M",
  R: "R",
  C: "M",
  D: "D",
  U: "M",
  "?": "U",
};

export function ChangeRow({
  change,
  touched,
  selected,
  active,
  onToggle,
  onSelect,
  onOpenDiff,
  onShowInEditor,
  onRollback,
  hidePathDir,
}: Props) {
  const tone = STATUS_TONE[change.status];
  const parts = splitPath(change.path);

  // Keep the checkbox toggle independent of the row "select" action — clicking the checkbox
  // shouldn't also activate the row (which would feel like a double-tap).
  const stopProp = (e: MouseEvent) => e.stopPropagation();

  const row = (
    <div
      className="pid-git-row"
      data-tone={tone}
      data-touched={touched || undefined}
      data-active={active || undefined}
      title={touched ? `${change.path} · touched by current session` : change.path}
    >
      <input
        type="checkbox"
        className="pid-git-row-check"
        checked={selected}
        onChange={onToggle}
        onClick={stopProp}
        aria-label={`Stage ${change.path}`}
      />
      <button
        type="button"
        className="pid-git-row-body"
        onClick={onSelect}
        onDoubleClick={onOpenDiff}
      >
        <span className="pid-git-row-status" aria-hidden>
          {STATUS_LABEL[change.status]}
        </span>
        <PidPierreFileIcon path={change.path} size={14} className="pid-git-row-fileicon" />
        <span className="pid-git-row-name">
          <span className="pid-git-row-filename">{parts.name}</span>
          {parts.dir && !hidePathDir ? <span className="pid-git-row-dir">{parts.dir}</span> : null}
        </span>
        <span className="pid-git-row-counts" aria-hidden>
          {change.add > 0 ? <span data-tone="add">+{change.add}</span> : null}
          {change.del > 0 ? <span data-tone="del">−{change.del}</span> : null}
          {touched ? <span className="pid-git-row-touch" aria-hidden /> : null}
        </span>
      </button>
    </div>
  );

  // Build the row's right-click actions. A deleted file has nothing on disk to open (so no editor
  // action), but rollback still applies — it restores the deletion.
  const items: ContextMenuItem[] = [];
  if (onShowInEditor && change.status !== "D") {
    items.push({
      label: "Open file in editor",
      icon: <FileText size={12} />,
      onSelect: onShowInEditor,
    });
  }
  if (onRollback) {
    if (items.length > 0) items.push({ kind: "separator" });
    items.push({
      label: "Rollback",
      icon: <Undo2 size={12} />,
      onSelect: onRollback,
      danger: true,
    });
  }
  if (items.length === 0) return row;
  return <ContextMenu items={items}>{row}</ContextMenu>;
}

function splitPath(path: string): { name: string; dir: string } {
  const ix = path.lastIndexOf("/");
  if (ix < 0) return { name: path, dir: "" };
  return { name: path.slice(ix + 1), dir: path.slice(0, ix) };
}
