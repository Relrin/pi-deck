import { type LSPClient, LSPPlugin, Workspace, type WorkspaceFile } from "@codemirror/lsp-client";
import type { ChangeSet, Text } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { type LspMapping, uriToDeckPath } from "@pi-deck/core/lsp/uri.js";
import { useNavStore } from "../../../lib/useNavStore.js";
import { getEditorView } from "../editorViewBridge.js";
import { useEditorStore } from "../useEditorStore.js";

export interface PidWorkspaceContext {
  projectId: string;
  mapping: LspMapping;
  /** POSIX deck path of the project root (`uriToDeckPath(rootUri, mapping)`). */
  deckRoot: string;
}

class PidWorkspaceFile implements WorkspaceFile {
  constructor(
    readonly uri: string,
    readonly languageId: string,
    public version: number,
    public doc: Text,
    readonly view: EditorView,
  ) {}

  getView(): EditorView {
    return this.view;
  }
}

/**
 * The lsp-client workspace for pi-deck's single-view editor. File tracking and sync mirror the
 * package's (unexported) default workspace — one view per file, versions bumped on sync — and
 * `displayFile` is wired into the editor store so cross-file go-to-definition opens a real tab.
 *
 * Because the editor mounts one `EditorView` that swaps per-tab `EditorState`s, exactly one
 * file is open at the server at a time: switching tabs destroys the old state's `LSPPlugin`
 * (didClose) and creates the new one (didOpen).
 */
export class PidLspWorkspace extends Workspace {
  files: PidWorkspaceFile[] = [];
  private readonly fileVersions = new Map<string, number>();

  constructor(
    client: LSPClient,
    private readonly ctx: PidWorkspaceContext,
  ) {
    super(client);
  }

  private nextFileVersion(uri: string): number {
    const next = (this.fileVersions.get(uri) ?? -1) + 1;
    this.fileVersions.set(uri, next);
    return next;
  }

  syncFiles(): readonly { file: WorkspaceFile; prevDoc: Text; changes: ChangeSet }[] {
    const result: { file: PidWorkspaceFile; prevDoc: Text; changes: ChangeSet }[] = [];
    for (const file of this.files) {
      const plugin = LSPPlugin.get(file.view);
      if (!plugin) continue;
      const changes = plugin.unsyncedChanges;
      if (!changes.empty) {
        result.push({ changes, file, prevDoc: file.doc });
        file.doc = file.view.state.doc;
        file.version = this.nextFileVersion(file.uri);
        plugin.clear();
      }
    }
    return result;
  }

  openFile(uri: string, languageId: string, view: EditorView): void {
    if (this.getFile(uri)) return; // single view per file — a stale re-open is a no-op
    const file = new PidWorkspaceFile(
      uri,
      languageId,
      this.nextFileVersion(uri),
      view.state.doc,
      view,
    );
    this.files.push(file);
    this.client.didOpen(file);
  }

  closeFile(uri: string): void {
    const file = this.getFile(uri);
    if (!file) return;
    this.files = this.files.filter((f) => f !== file);
    this.client.didClose(uri);
  }

  override async displayFile(uri: string): Promise<EditorView | null> {
    const open = this.getFile(uri);
    if (open) {
      const view = open.getView();
      if (view) return view;
    }
    const deckPath = uriToDeckPath(uri, this.ctx.mapping);
    if (!deckPath) return null;
    const rootPrefix = `${this.ctx.deckRoot}/`;
    // Definitions outside the project root (global typings, toolchain sources) can't be read
    // through the project-confined fs commands — decline rather than error.
    if (!deckPath.startsWith(rootPrefix)) return null;
    useEditorStore.getState().openFile({
      projectId: this.ctx.projectId,
      absPath: deckPath,
      relPath: deckPath.slice(rootPrefix.length),
    });
    useNavStore.getState().setScreen("editor");
    return waitForViewOn(uri);
  }
}

/**
 * Resolve once the single editor view has swapped to the tab whose LSP plugin carries `uri` —
 * i.e. the opened file finished loading and its state (including the LSP extension) is live.
 */
function waitForViewOn(uri: string): Promise<EditorView | null> {
  return new Promise((resolve) => {
    const deadline = Date.now() + 8_000;
    const tick = () => {
      const view = getEditorView();
      const plugin = view ? LSPPlugin.get(view) : null;
      if (view && plugin?.uri === uri) {
        resolve(view);
        return;
      }
      if (Date.now() > deadline) {
        resolve(null);
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}
