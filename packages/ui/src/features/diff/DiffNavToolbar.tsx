import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pencil } from "../../components/icons/index.js";
import { Tooltip } from "../../components/ui/Tooltip.js";

interface DiffNavToolbarProps {
  /** Scroll to the previous / next change block within the current file's diff. */
  onPrevDiff: () => void;
  onNextDiff: () => void;
  /** Open the current file in the editor (EDITOR screen). */
  onJumpToSource: () => void;
  /** Switch the diff to the previous / next changed file in the working tree. */
  onPrevFile: () => void;
  onNextFile: () => void;
  /** Disabled when there's no previous / next changed file to compare against. */
  prevFileDisabled: boolean;
  nextFileDisabled: boolean;
}

/**
 * Floating navigation panel for the diff screen. Two groups, split by a vertical divider:
 *   1. within-file: previous diff · next diff · jump to source
 *   2. across-file: compare previous file · compare next file
 */
export function DiffNavToolbar({
  onPrevDiff,
  onNextDiff,
  onJumpToSource,
  onPrevFile,
  onNextFile,
  prevFileDisabled,
  nextFileDisabled,
}: DiffNavToolbarProps) {
  return (
    <div className="pid-diff-nav-toolbar" role="toolbar" aria-label="Diff navigation">
      <Tooltip content="Previous diff">
        <button
          type="button"
          className="pid-diff-nav-btn"
          onClick={onPrevDiff}
          aria-label="Previous diff"
        >
          <ArrowUp size={14} aria-hidden />
        </button>
      </Tooltip>
      <Tooltip content="Next diff">
        <button
          type="button"
          className="pid-diff-nav-btn"
          onClick={onNextDiff}
          aria-label="Next diff"
        >
          <ArrowDown size={14} aria-hidden />
        </button>
      </Tooltip>
      <Tooltip content="Jump to source">
        <button
          type="button"
          className="pid-diff-nav-btn"
          onClick={onJumpToSource}
          aria-label="Jump to source"
        >
          <Pencil size={14} aria-hidden />
        </button>
      </Tooltip>
      <span className="pid-diff-nav-sep" aria-hidden />
      <Tooltip content="Compare previous file">
        <button
          type="button"
          className="pid-diff-nav-btn"
          onClick={onPrevFile}
          disabled={prevFileDisabled}
          aria-label="Compare previous file"
        >
          <ArrowLeft size={14} aria-hidden />
        </button>
      </Tooltip>
      <Tooltip content="Compare next file">
        <button
          type="button"
          className="pid-diff-nav-btn"
          onClick={onNextFile}
          disabled={nextFileDisabled}
          aria-label="Compare next file"
        >
          <ArrowRight size={14} aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
}
