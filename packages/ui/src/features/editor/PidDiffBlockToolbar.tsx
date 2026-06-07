import type { RefObject } from "react";
import { ArrowDown, ArrowLeftRight, ArrowUp, Undo2 } from "../../components/icons/index.js";
import { Tooltip } from "../../components/ui/Tooltip.js";
import type { DiffHoverInfo } from "./diffExtension.js";

interface PidDiffBlockToolbarProps {
  info: DiffHoverInfo;
  /** Ref to the toolbar root — the editor uses it to tell toolbar clicks from dismiss clicks. */
  rootRef: RefObject<HTMLDivElement | null>;
  /** The editor wrap the toolbar is positioned within (to convert client to local coords). */
  wrapRef: RefObject<HTMLDivElement | null>;
  onPrev: () => void;
  onNext: () => void;
  onRevert: () => void;
  onOpenDiff: () => void;
}

/**
 * Floating actions for the selected diff block — prev/next change, revert (undoable), open Diff.
 * Opened by clicking the block's gutter; pinned at the clicked line until dismissed.
 */
export function PidDiffBlockToolbar({
  info,
  rootRef,
  wrapRef,
  onPrev,
  onNext,
  onRevert,
  onOpenDiff,
}: PidDiffBlockToolbarProps) {
  const wrap = wrapRef.current?.getBoundingClientRect();
  const top = info.clientTop - (wrap?.top ?? 0);
  const left = info.clientLeft - (wrap?.left ?? 0);

  return (
    <div
      ref={rootRef}
      className={`pid-diff-block-toolbar pid-diff-block-toolbar-${info.kind}`}
      style={{ top, left }}
      role="toolbar"
      aria-label="Diff block actions"
    >
      <Tooltip content="Previous change">
        <button
          type="button"
          className="pid-diff-block-toolbar-btn"
          onClick={onPrev}
          aria-label="Previous change"
        >
          <ArrowUp size={13} aria-hidden="true" />
        </button>
      </Tooltip>
      <Tooltip content="Next change">
        <button
          type="button"
          className="pid-diff-block-toolbar-btn"
          onClick={onNext}
          aria-label="Next change"
        >
          <ArrowDown size={13} aria-hidden="true" />
        </button>
      </Tooltip>
      <Tooltip content="Revert this block">
        <button
          type="button"
          className="pid-diff-block-toolbar-btn"
          onClick={onRevert}
          aria-label="Revert this block"
        >
          <Undo2 size={13} aria-hidden="true" />
        </button>
      </Tooltip>
      <Tooltip content="Show Diff for lines">
        <button
          type="button"
          className="pid-diff-block-toolbar-btn"
          onClick={onOpenDiff}
          aria-label="Show Diff for lines"
        >
          <ArrowLeftRight size={13} aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  );
}
