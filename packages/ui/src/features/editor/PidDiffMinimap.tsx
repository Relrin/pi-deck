import { useI18nContext } from "../../i18n/i18n-react.js";
import type { DiffOverviewMark } from "./diffExtension.js";

interface PidDiffMinimapProps {
  /** Per-block marks, already projected onto a 0..1 vertical axis (see `diffOverview`). */
  marks: DiffOverviewMark[];
  /** Jump the editor to a change block (select + centre-scroll). */
  onJumpToChunk: (index: number) => void;
}

/**
 * Git-diff overview ruler shown beside the editor's vertical scrollbar — a whole-file map of where
 * changes sit (not a code minimap). Each change block is a clickable mark coloured with the same
 * add/mod/del tokens as the gutter bar, positioned by its line fraction in the document.
 */
export function PidDiffMinimap({ marks, onJumpToChunk }: PidDiffMinimapProps) {
  const { LL } = useI18nContext();
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
          // Two complete key sets rather than one plus `.toLowerCase()`: in a language with
          // cases the mid-sentence form is a different word, not a different capitalisation.
          aria-label={LL.editor.minimap.jumpTo[m.kind]()}
          title={LL.editor.minimap.kind[m.kind]()}
        />
      ))}
    </div>
  );
}
