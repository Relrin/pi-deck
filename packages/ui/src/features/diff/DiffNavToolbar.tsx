import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pencil } from "../../components/icons/index.js";
import { Tooltip } from "../../components/ui/Tooltip.js";
import { useI18nContext } from "../../i18n/i18n-react.js";

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
  const { LL } = useI18nContext();
  const copy = LL.diff.nav;
  return (
    <div className="pid-diff-nav-toolbar" role="toolbar" aria-label={copy.label()}>
      <Tooltip content={copy.prevDiff()}>
        <button
          type="button"
          className="pid-diff-nav-btn"
          onClick={onPrevDiff}
          aria-label={copy.prevDiff()}
        >
          <ArrowUp size={14} aria-hidden />
        </button>
      </Tooltip>
      <Tooltip content={copy.nextDiff()}>
        <button
          type="button"
          className="pid-diff-nav-btn"
          onClick={onNextDiff}
          aria-label={copy.nextDiff()}
        >
          <ArrowDown size={14} aria-hidden />
        </button>
      </Tooltip>
      <Tooltip content={copy.jumpToSource()}>
        <button
          type="button"
          className="pid-diff-nav-btn"
          onClick={onJumpToSource}
          aria-label={copy.jumpToSource()}
        >
          <Pencil size={14} aria-hidden />
        </button>
      </Tooltip>
      <span className="pid-diff-nav-sep" aria-hidden />
      <Tooltip content={copy.prevFile()}>
        <button
          type="button"
          className="pid-diff-nav-btn"
          onClick={onPrevFile}
          disabled={prevFileDisabled}
          aria-label={copy.prevFile()}
        >
          <ArrowLeft size={14} aria-hidden />
        </button>
      </Tooltip>
      <Tooltip content={copy.nextFile()}>
        <button
          type="button"
          className="pid-diff-nav-btn"
          onClick={onNextFile}
          disabled={nextFileDisabled}
          aria-label={copy.nextFile()}
        >
          <ArrowRight size={14} aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
}
