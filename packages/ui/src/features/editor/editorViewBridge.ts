import { EditorView } from "@codemirror/view";

/**
 * Bridge between the mounted CodeMirror editor and out-of-tree UI (the footer status bar).
 *
 * `CodeMirrorEditor` keeps a single `EditorView` that swaps state per tab, so there is only ever
 * one live view and it always shows the active tab. It publishes that view here on mount so the
 * "Go to Line:Column" control in the footer can drive the caret without prop-drilling a ref
 * across the whole layout.
 */
let activeView: EditorView | null = null;

/** Publish (on mount) or clear (on unmount) the editor's single `EditorView`. */
export function registerEditorView(view: EditorView | null): void {
  activeView = view;
}

/**
 * Move the caret to a 1-based line/column in the active editor and scroll it to the centre. Both
 * coordinates are clamped to the document bounds. No-ops when no editor is mounted.
 */
export function gotoLineColumn(line: number, col: number): void {
  const view = activeView;
  if (!view) return;
  const { doc } = view.state;
  const lineNo = Math.max(1, Math.min(Math.floor(line), doc.lines));
  const lineObj = doc.line(lineNo);
  const colNo = Math.max(1, Math.min(Math.floor(col), lineObj.length + 1));
  const pos = lineObj.from + (colNo - 1);
  view.dispatch({
    selection: { anchor: pos },
    effects: EditorView.scrollIntoView(pos, { y: "center" }),
  });
  view.focus();
}
