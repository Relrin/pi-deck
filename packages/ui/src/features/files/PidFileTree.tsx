import { themeToTreeStyles } from "@pierre/trees";
import { FileTree, useFileTree } from "@pierre/trees/react";
import { useEffect, useMemo, useRef } from "react";
import { useThemeStore } from "../../theme/useThemeStore.js";
import { useGitStore } from "../git/useGitStore.js";
import { useProjectsStore } from "../sessions/useProjectsStore.js";
import { PidFileTreeEmptyState } from "./PidFileTreeEmptyState.js";
import { buildTreeThemeInput, flattenFsNodes, readThemeTokens } from "./pierreTreeAdapters.js";
import { useFileTreeStore } from "./useFileTreeStore.js";

/** Stable reference so `gitTotals ?? EMPTY_TOTALS` doesn't allocate per render. */
const EMPTY_TOTALS = { add: 0, del: 0 } as const;

/**
 * Files-tab tree, rendered by `@pierre/trees`. The library owns rendering, virtualization,
 * keyboard navigation, icons, and (in later stages) search / DnD / context menus. pi-deck
 * feeds it a flat path list derived from the host filesystem walk and themes it from the
 * active palette.
 *
 * The host walk + fs watcher still source the data — `useFileTreeStore` loads the `FsNode`
 * snapshot per project and applies watcher deltas — we just flatten it into paths and push
 * them into the Pierre model via `resetPaths`.
 */
export function PidFileTree() {
  const projectId = useProjectsStore((s) => s.activeProjectId);
  const project = useProjectsStore((s) =>
    s.activeProjectId ? s.projects.find((p) => p.id === s.activeProjectId) : undefined,
  );

  const nodes = useFileTreeStore((s) => (projectId ? s.byProject[projectId]?.nodes : undefined));
  const treeError = useFileTreeStore((s) =>
    projectId ? s.byProject[projectId]?.error : undefined,
  );
  const ensureTree = useFileTreeStore((s) => s.ensureTree);

  const gitTotals = useGitStore((s) =>
    projectId ? s.statusByProject[projectId]?.totals : undefined,
  );

  // Theme: map the active palette's resolved CSS tokens onto the tree's `--trees-theme-*`
  // custom properties. Recomputed only when the theme identity changes (reading computed
  // styles forces a layout flush, so we don't want it on every render).
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

  // Build the model once for the component's lifetime; updates flow through model methods.
  const { model } = useFileTree({
    paths: [],
    flattenEmptyDirectories: true,
    initialExpansion: "closed",
    icons: { set: "complete", colored: true },
  });

  // Walk the project on first mount + when projectId changes. The host caches the snapshot.
  useEffect(() => {
    if (!projectId) return;
    void ensureTree(projectId);
  }, [projectId, ensureTree]);

  // Push the flattened path list into the model whenever the snapshot changes
  const lastPathsKey = useRef<string>("");
  useEffect(() => {
    const paths = nodes ? flattenFsNodes(nodes) : [];
    const key = paths.join("\n");
    if (key === lastPathsKey.current) return;
    lastPathsKey.current = key;
    model.resetPaths(paths);
  }, [nodes, model]);

  const totals = gitTotals ?? EMPTY_TOTALS;

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
        <span className="pid-tree-header-spacer" />
        {totals.add > 0 ? (
          <span className="pid-tree-header-total" data-tone="add">
            +{totals.add}
          </span>
        ) : null}
        {totals.del > 0 ? (
          <span className="pid-tree-header-total" data-tone="del">
            −{totals.del}
          </span>
        ) : null}
      </div>
      <FileTree
        model={model}
        className="pid-tree-pierre"
        style={themeStyle}
        aria-label="Project files"
      />
    </div>
  );
}
