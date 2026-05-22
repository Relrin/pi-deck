import { Icon } from "@iconify/react";
import type { GitChange } from "@pi-deck/core/git/types.js";
import type { MouseEvent } from "react";
import { iconForFile } from "../../components/icons/file-icons.js";

interface Props {
  change: GitChange;
  /** True when the active session's agent has written to this path. */
  touched?: boolean;
  /** Checkbox state — staging intent only, no actual git side-effect in v1. */
  selected: boolean;
  /** Highlights the row (accent background + left border) like the screenshot's first row. */
  active: boolean;
  onToggle: () => void;
  onSelect: () => void;
}

const STATUS_TONE: Record<GitChange["status"], "add" | "mod" | "del" | "unt"> = {
  A: "add",
  M: "mod",
  R: "mod",
  C: "mod",
  D: "del",
  U: "del",
  "?": "unt",
};

export function ChangeRow({ change, touched, selected, active, onToggle, onSelect }: Props) {
  const tone = STATUS_TONE[change.status];
  const parts = splitPath(change.path);
  const fileIcon = iconForFile(change.path);

  // Keep the checkbox toggle independent of the row "select" action — clicking the checkbox
  // shouldn't also activate the row (which would feel like a double-tap).
  const stopProp = (e: MouseEvent) => e.stopPropagation();

  return (
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
      <button type="button" className="pid-git-row-body" onClick={onSelect}>
        <span className="pid-git-row-status" aria-hidden>
          {change.status}
        </span>
        <Icon icon={fileIcon} className="pid-git-row-fileicon" aria-hidden width={14} height={14} />
        <span className="pid-git-row-name">
          <span className="pid-git-row-filename">{parts.name}</span>
          {parts.dir ? <span className="pid-git-row-dir">{parts.dir}</span> : null}
        </span>
        <span className="pid-git-row-counts" aria-hidden>
          {change.add > 0 ? <span data-tone="add">+{change.add}</span> : null}
          {change.del > 0 ? <span data-tone="del">−{change.del}</span> : null}
          {touched ? <span className="pid-git-row-touch" aria-hidden /> : null}
        </span>
      </button>
    </div>
  );
}

function splitPath(path: string): { name: string; dir: string } {
  const ix = path.lastIndexOf("/");
  if (ix < 0) return { name: path, dir: "" };
  return { name: path.slice(ix + 1), dir: path.slice(0, ix) };
}
