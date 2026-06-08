import type { DiffKind, DiffOverviewMark } from "./diffExtension.js";

interface PidDiffMinimapProps {
  /** Per-block marks, already projected onto a 0..1 vertical axis (see `diffOverview`). */
  marks: DiffOverviewMark[];
  /** Jump the editor to a change block (select + centre-scroll). */
  onJumpToChunk: (index: number) => void;
}

const KIND_LABEL: Record<DiffKind, string> = {
  add: "Added",
  mod: "Modified",
  del: "Removed",
};

/**
 * Git-diff overview ruler shown beside the editor's vertical scrollbar — a whole-file map of where
 * changes sit (not a code minimap). Each change block is a clickable mark coloured with the same
 * add/mod/del tokens as the gutter bar, positioned by its line fraction in the document.
 */
export function PidDiffMinimap({ marks, onJumpToChunk }: PidDiffMinimapProps) {
  return (
    <div className="pid-editor-cm-minimap">
      {marks.map((m) => (
        <button
          key={m.index}
          type="button"
          className={`pid-editor-cm-minimap-mark ${m.kind}`}
          style={{ top: `${m.top * 100}%`, height: `${m.size * 100}%` }}
          onClick={(e) => {
            e.stopPropagation();
            onJumpToChunk(m.index);
          }}
          aria-label={`Jump to ${KIND_LABEL[m.kind].toLowerCase()} change`}
          title={`${KIND_LABEL[m.kind]} change`}
        />
      ))}
    </div>
  );
}
