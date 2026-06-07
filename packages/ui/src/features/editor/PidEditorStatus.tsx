import { useProjectsStore } from "../sessions/useProjectsStore.js";
import { eolLabel } from "./eol.js";
import { selectActiveTab, useEditorStore } from "./useEditorStore.js";

/**
 * Status segments for the active editor tab — rendered in the footer's right region
 * (after the spacer) only while the editor screen is active. Shows cursor position, indentation,
 * encoding, line ending, and language.
 */
export function PidEditorStatus() {
  const projectId = useProjectsStore((s) => s.activeProjectId);
  const tab = useEditorStore(selectActiveTab(projectId));
  if (!tab) return null;
  const { cursor } = tab;
  const indentLabel = tab.indentUseTabs
    ? `Tab Size: ${tab.indentWidth}`
    : `Spaces: ${tab.indentWidth}`;

  return (
    <>
      <div className="seg">
        <span>
          Ln {cursor.line}, Col {cursor.col}
        </span>
        {cursor.selLen > 0 ? <span className="lbl">({cursor.selLen} selected)</span> : null}
      </div>
      <div className="seg">
        <span>{indentLabel}</span>
      </div>
      <div className="seg">
        <span>UTF-8</span>
      </div>
      <div className="seg">
        <span>{eolLabel(tab.eol)}</span>
      </div>
      <div className="seg">
        <span>{tab.languageLabel}</span>
      </div>
    </>
  );
}
