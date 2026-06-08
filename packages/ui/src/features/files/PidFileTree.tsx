import type { PromptAttachment } from "@pi-deck/core/protocol/commands.js";
import type {
  ContextMenuItem,
  ContextMenuOpenContext,
  FileTreeDropResult,
  FileTree as FileTreeModel,
  FileTreeRenameEvent,
} from "@pierre/trees";
import { themeToTreeStyles } from "@pierre/trees";
import { FileTree, useFileTree } from "@pierre/trees/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { humanizeError } from "../../lib/format/humanize-error.js";
import { useNavStore } from "../../lib/useNavStore.js";
import { useThemeStore } from "../../theme/useThemeStore.js";
import { useNotificationStore } from "../_status/useNotificationStore.js";
import { useEditorStore } from "../editor/useEditorStore.js";
import { useGitStore } from "../git/useGitStore.js";
import { useIntroComposerStore } from "../intro/useIntroComposerStore.js";
import { useProjectsStore } from "../sessions/useProjectsStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { PidConfirmDeleteDialog } from "./PidConfirmDeleteDialog.js";
import { PidFileTreeEmptyState } from "./PidFileTreeEmptyState.js";
import { PidTreeContextMenu } from "./PidTreeContextMenu.js";
import { PidTreeSearch } from "./PidTreeSearch.js";
import {
  buildTreeThemeInput,
  flattenFsNodes,
  gitChangeByTreePath,
  gitChangesToEntries,
  readThemeTokens,
  stripTrailingSlash,
  treePathBasename,
  treePathParent,
  treeRelToAbs,
} from "./pierreTreeAdapters.js";
import { useFileTreeStore } from "./useFileTreeStore.js";

const TREE_SCROLLBAR_CSS = `
[data-file-tree-virtualized-scroll='true'],
[data-file-tree-scrollbar-measure='true'] {
  scrollbar-width: thin;
  scrollbar-color: var(--bg-3) transparent;
}`;

/** A draft `add` + inline-rename in flight, keyed by the placeholder's project-relative path. */
interface PendingCreate {
  mode: "file" | "folder";
  parentRel: string;
}

/**
 * Files-tab tree, rendered by `@pierre/trees`. The library owns rendering, virtualization,
 * keyboard navigation, icons, search, and the inline rename input; pi-deck feeds it a flat
 * path list from the host filesystem walk and routes mutations back through the host fs
 * commands (`fs.rename` / `fs.move` / `fs.createFile` / `fs.createFolder` / `fs.delete`).
 */
export function PidFileTree() {
  const projectId = useProjectsStore((s) => s.activeProjectId);
  const project = useProjectsStore((s) =>
    s.activeProjectId ? s.projects.find((p) => p.id === s.activeProjectId) : undefined,
  );

  const nodes = useFileTreeStore((s) => (projectId ? s.byProject[projectId]?.nodes : undefined));
  const root = useFileTreeStore((s) => (projectId ? s.byProject[projectId]?.root : undefined));
  const treeError = useFileTreeStore((s) =>
    projectId ? s.byProject[projectId]?.error : undefined,
  );
  const ensureTree = useFileTreeStore((s) => s.ensureTree);

  const gitChanges = useGitStore((s) =>
    projectId ? s.statusByProject[projectId]?.changes : undefined,
  );
  const gitRoot = useGitStore((s) => (projectId ? s.statusByProject[projectId]?.root : undefined));
  const ensureStatus = useGitStore((s) => s.ensureStatus);

  // Live values read by the model's construction-time callbacks (onRename, etc.), which are
  // captured once and would otherwise close over stale renders.
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  const rootRef = useRef(root);
  rootRef.current = root;

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const modelRef = useRef<FileTreeModel | null>(null);
  const pendingCreateRef = useRef<Map<string, PendingCreate>>(new Map());

  const [pendingDelete, setPendingDelete] = useState<string[] | undefined>(undefined);

  const themeName = useThemeStore((s) => s.activeName);
  const themeKind = useThemeStore(
    (s) =>
      s.activeSpec?.meta?.kind ?? s.available.find((t) => t.name === s.activeName)?.kind ?? "dark",
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: themeName is an intentional cache key.
  const themeStyle = useMemo(() => {
    if (typeof document === "undefined") return undefined;
    const tokens = readThemeTokens(document.documentElement);
    return themeToTreeStyles(buildTreeThemeInput(tokens, themeKind));
  }, [themeName, themeKind]);

  // Rename / create
  const handleRename = useCallback((event: FileTreeRenameEvent) => {
    const pid = projectIdRef.current;
    const r = rootRef.current;
    const client = useSessionsStore.getState().client;
    if (!pid || !r || !client) return;
    const srcKey = stripTrailingSlash(event.sourcePath);
    const name = treePathBasename(event.destinationPath);
    const pending = pendingCreateRef.current.get(srcKey);
    if (pending) {
      pendingCreateRef.current.delete(srcKey);
      const parentDir = treeRelToAbs(r, pending.parentRel);
      const command = pending.mode === "folder" ? "fs.createFolder" : "fs.createFile";
      client.call(command, { projectId: pid, parentDir, name }).catch((err: unknown) => {
        useNotificationStore.getState().error(humanizeError(err, "Failed to create item"));
        // Roll back the optimistic node Pierre added so the tree matches disk.
        try {
          modelRef.current?.remove(event.destinationPath);
        } catch {
          // best-effort
        }
      });
      return;
    }
    const fromPath = treeRelToAbs(r, srcKey);
    client.call("fs.rename", { projectId: pid, fromPath, toName: name }).catch((err: unknown) => {
      useNotificationStore.getState().error(humanizeError(err, "Failed to rename"));
    });
  }, []);

  const handleRenameError = useCallback((error: string) => {
    useNotificationStore.getState().error(error);
  }, []);

  // In-tree drag-and-drop support
  const handleDrop = useCallback((event: FileTreeDropResult) => {
    const pid = projectIdRef.current;
    const r = rootRef.current;
    const client = useSessionsStore.getState().client;
    if (!pid || !r || event.draggedPaths.length === 0) {
      return;
    }
    if (!client) return;
    const toDir = treeRelToAbs(r, event.target.directoryPath ?? "");
    const moves = event.draggedPaths.map((p) =>
      client.call("fs.move", { projectId: pid, fromPath: treeRelToAbs(r, p), toDir }),
    );
    Promise.all(moves).catch((err: unknown) => {
      useNotificationStore.getState().error(humanizeError(err, "Failed to move"));
      modelRef.current?.resetPaths(flattenFsNodes(nodesRef.current ?? []));
    });
  }, []);

  const handleDropError = useCallback((error: string) => {
    useNotificationStore.getState().error(error);
  }, []);

  // Open a file in the editor on double-click
  const handleDoubleClick = useCallback(() => {
    const pid = projectIdRef.current;
    const r = rootRef.current;
    if (!pid || !r) return;

    const selected = modelRef.current?.getSelectedPaths() ?? [];
    if (selected.length !== 1) return;

    const path = selected[0];
    if (!path || path.endsWith("/")) return;
    if (modelRef.current?.getItem(path)?.isDirectory()) return;
    useEditorStore.getState().openFile({
      projectId: pid,
      absPath: treeRelToAbs(r, path),
      relPath: stripTrailingSlash(path),
    });
    useNavStore.getState().setScreen("editor");
  }, []);

  // Build the model once for the component's lifetime; updates flow through model methods.
  const { model } = useFileTree({
    paths: [],
    flattenEmptyDirectories: true,
    initialExpansion: "closed",
    icons: { set: "complete", colored: true },
    itemHeight: 28,
    unsafeCSS: TREE_SCROLLBAR_CSS,
    // Drive search from our own input (PidTreeSearch); hide non-matches to mirror the
    // previous fuse-filter behaviour.
    fileTreeSearchMode: "hide-non-matches",
    renaming: { onRename: handleRename, onError: handleRenameError },
    dragAndDrop: { onDropComplete: handleDrop, onDropError: handleDropError },
  });
  modelRef.current = model;

  // Begin an inline create input
  const beginCreate = useCallback(
    (item: ContextMenuItem, mode: "file" | "folder") => {
      const parentRel =
        item.kind === "directory" ? stripTrailingSlash(item.path) : treePathParent(item.path);
      const base = mode === "folder" ? "untitled-folder" : "untitled";
      const exists = (rel: string) =>
        model.getItem(rel) != null || model.getItem(`${rel}/`) != null;
      let name = base;
      let rel = parentRel ? `${parentRel}/${name}` : name;
      for (let n = 2; exists(rel); n++) {
        name = `${base}-${n}`;
        rel = parentRel ? `${parentRel}/${name}` : name;
      }
      pendingCreateRef.current.set(rel, { mode, parentRel });
      const addPath = mode === "folder" ? `${rel}/` : rel;
      model.add(addPath);
      model.startRenaming(addPath, { removeIfCanceled: true });
    },
    [model],
  );

  // Resolve the action target(s): the multi-selection when the clicked row is part of it,
  // otherwise just the clicked row. Mirrors the old tree's right-click behaviour.
  const targetsForItem = useCallback(
    (item: ContextMenuItem): string[] => {
      const selected = model.getSelectedPaths();
      return selected.includes(item.path) ? [...selected] : [item.path];
    },
    [model],
  );

  const requestDeleteFromItem = useCallback(
    (item: ContextMenuItem) => {
      const r = rootRef.current;
      if (!r) return;
      setPendingDelete(targetsForItem(item).map((p) => treeRelToAbs(r, p)));
    },
    [targetsForItem],
  );

  // Attach the selection to the chat composer (the in-app drag-to-attach gesture's
  // keyboard/menu equivalent, since Pierre's pointer-based DnD doesn't carry our MIME).
  const attachToChat = useCallback(
    (item: ContextMenuItem) => {
      const r = rootRef.current;
      if (!r) return;
      const attachments: PromptAttachment[] = targetsForItem(item).map((p) => {
        const isDir = model.getItem(p)?.isDirectory() ?? p.endsWith("/");
        return { kind: isDir ? "folder" : "file", path: treeRelToAbs(r, p) };
      });
      if (attachments.length > 0) useIntroComposerStore.getState().addAttachments(attachments);
    },
    [model, targetsForItem],
  );

  // Lookup of changed files (project-relative path → git change) for the row context menu.
  const changeByPath = useMemo(
    () => gitChangeByTreePath(gitChanges ?? [], gitRoot, root),
    [gitChanges, gitRoot, root],
  );

  const renderContextMenu = useCallback(
    (item: ContextMenuItem, ctx: ContextMenuOpenContext) => {
      // "Show diff" only for changed, tracked files — untracked files have no HEAD to diff against,
      // and directories aren't a single file. `path` is project-relative, which is what diff.get
      // resolves against the project root.
      const rel = stripTrailingSlash(item.path);
      const change = item.kind === "directory" ? undefined : changeByPath.get(rel);
      const onShowDiff =
        change && change.status !== "?"
          ? () => {
              const pid = projectIdRef.current;
              if (pid) useNavStore.getState().openDiff({ projectId: pid, path: rel });
            }
          : undefined;
      return (
        <PidTreeContextMenu
          item={item}
          ctx={ctx}
          onShowDiff={onShowDiff}
          onNewFile={(it) => beginCreate(it, "file")}
          onNewFolder={(it) => beginCreate(it, "folder")}
          onAttach={attachToChat}
          onRename={(it) => model.startRenaming(it.path)}
          onDelete={requestDeleteFromItem}
        />
      );
    },
    [model, beginCreate, attachToChat, requestDeleteFromItem, changeByPath],
  );

  // Delete via keyboard
  const bodyWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bodyWrapRef.current;
    if (!el) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      const isDelete = e.key === "Delete" || (e.key === "Backspace" && (e.metaKey || e.ctrlKey));
      if (!isDelete) return;
      const r = rootRef.current;
      if (!r) return;
      const selected = modelRef.current?.getSelectedPaths() ?? [];
      if (selected.length === 0) return;
      e.preventDefault();
      setPendingDelete(selected.map((p) => treeRelToAbs(r, p)));
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, []);

  // Walk the project + load git status on first mount + when projectId changes.
  useEffect(() => {
    if (!projectId) return;
    void ensureTree(projectId);
    void ensureStatus(projectId);
  }, [projectId, ensureTree, ensureStatus]);

  // Push the flattened path list into the model whenever the snapshot changes (initial load,
  // project switch, watcher delta). `resetPaths` is coarse but correct; skip identical churn
  // so no-op watcher fires don't clobber expansion state.
  const lastPathsKey = useRef<string>("");
  useEffect(() => {
    const paths = nodes ? flattenFsNodes(nodes) : [];
    const key = paths.join("\n");
    if (key === lastPathsKey.current) return;
    lastPathsKey.current = key;
    model.resetPaths(paths);
  }, [nodes, model]);

  // Push git decorations whenever the status changes. `nodes` is in the dep list (though not
  // read here) so the entries are re-applied after a `resetPaths` — which runs first, being
  // declared above — since decorations only attach to paths the model already knows about.
  // biome-ignore lint/correctness/useExhaustiveDependencies: nodes re-triggers after a reset.
  useEffect(() => {
    model.setGitStatus(gitChangesToEntries(gitChanges ?? [], gitRoot, root));
  }, [gitChanges, gitRoot, root, nodes, model]);

  if (!projectId || !project) {
    return (
      <div className="pid-tree-shell">
        <PidFileTreeEmptyState kind="no-project" />
      </div>
    );
  }
  if (treeError) {
    return (
      <div className="pid-tree-shell">
        <PidFileTreeEmptyState kind="error" errorMessage={treeError} />
      </div>
    );
  }

  return (
    <div className="pid-tree-shell">
      <div className="pid-tree-header">
        <span className="pid-mono-label">{project.displayName}</span>
      </div>
      <div className="pid-tree-filter-row">
        <PidTreeSearch model={model} />
      </div>
      <div className="pid-tree-body-wrap" ref={bodyWrapRef}>
        <FileTree
          model={model}
          className="pid-tree-pierre"
          style={themeStyle}
          renderContextMenu={renderContextMenu}
          onDoubleClick={handleDoubleClick}
          aria-label="Project files"
        />
      </div>

      {pendingDelete && (
        <PidConfirmDeleteDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(undefined);
          }}
          paths={pendingDelete}
          projectRoot={root || project.path}
          onConfirm={async () => {
            const client = useSessionsStore.getState().client;
            if (client && projectId) {
              try {
                await client.call("fs.delete", { projectId, paths: pendingDelete });
              } catch (err) {
                useNotificationStore
                  .getState()
                  .error(humanizeError(err, "Failed to move to trash"));
              }
            }
            setPendingDelete(undefined);
          }}
        />
      )}
    </div>
  );
}
