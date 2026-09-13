import { useI18nContext } from "../../i18n/i18n-react.js";
import { useProjectsStore } from "../sessions/useProjectsStore.js";
import { CodeMirrorEditor } from "./CodeMirrorEditor.js";
import { PidEditorBreadcrumb } from "./PidEditorBreadcrumb.js";
import { PidEditorTabBar } from "./PidEditorTabBar.js";
import { useEditorStore } from "./useEditorStore.js";

/**
 * The EDITOR screen: a tab strip + styled breadcrumb on top, a CodeMirror editor below. Rendered
 * by `PidCenterRouter` when `useNavStore.screen === "editor"`. Open files are isolated per workspace.
 */
export function PidEditorView() {
  const { LL } = useI18nContext();
  const projectId = useProjectsStore((s) => s.activeProjectId);
  const hasTabs = useEditorStore((s) =>
    projectId ? (s.byProject[projectId]?.order.length ?? 0) > 0 : false,
  );

  if (!hasTabs) {
    return (
      <div className="pid-editor">
        <div className="pid-editor-empty">
          <p className="pid-editor-empty-title">{LL.editor.empty.title()}</p>
          <p className="pid-editor-empty-hint">{LL.editor.empty.hint()}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pid-editor">
      <PidEditorTabBar />
      <PidEditorBreadcrumb />
      <div className="pid-editor-body">
        <CodeMirrorEditor />
      </div>
    </div>
  );
}
