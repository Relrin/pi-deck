import type { FsNode } from "@pi-deck/core/fs/types.js";
import type { GitChange, GitChangeStatus } from "@pi-deck/core/git/types.js";
import type { GitStatusEntry, GitStatus as PierreGitStatus, TreeThemeInput } from "@pierre/trees";

/**
 * Pure adapters between pi-deck's data shapes and `@pierre/trees`. Kept free of React and DOM
 * (except the thin `readThemeTokens` reader) so the mapping logic is unit-testable.
 */

/**
 * Flatten the host walker's `FsNode` tree into the flat path list `@pierre/trees` consumes.
 * The library is path-first and infers folder structure from the path set, so directories
 * carry a trailing slash (which keeps *empty* directories visible — non-empty ones would be
 * inferred from their children regardless). Paths stay project-relative + POSIX.
 */
export function flattenFsNodes(nodes: readonly FsNode[]): string[] {
  const out: string[] = [];
  const walk = (items: readonly FsNode[]): void => {
    for (const node of items) {
      if (node.type === "dir") {
        out.push(`${node.relPath}/`);
        if (node.children) walk(node.children);
      } else {
        out.push(node.relPath);
      }
    }
  };
  walk(nodes);
  return out;
}

/**
 * Collapse pi-deck's porcelain status letter into Pierre's decoration vocabulary. The tree is
 * a coarser surface than the git sidebar, so `M` / `C` / `U` all read as "modified".
 */
export function gitStatusToPierre(status: GitChangeStatus): PierreGitStatus {
  switch (status) {
    case "A":
      return "added";
    case "D":
      return "deleted";
    case "?":
      return "untracked";
    case "R":
      return "renamed";
    default:
      return "modified";
  }
}

/**
 * Map git's repo-relative change list onto the tree's project-relative path space.
 *
 * Git reports paths relative to the repo root; the tree's identities are relative to the
 * opened project root. When they differ (project opened in a repo subdirectory, or — rarely —
 * above the repo) we round-trip through an absolute path and re-relativise, dropping anything
 * that falls outside the opened subtree.
 */
export function gitChangesToEntries(
  changes: readonly GitChange[],
  gitRoot: string | undefined,
  treeRoot: string | undefined,
): GitStatusEntry[] {
  const git = normalizeRoot(gitRoot);
  const tree = normalizeRoot(treeRoot);
  // Only round-trip through an absolute path when the two roots genuinely differ; otherwise
  // (equal roots, or either unknown) git's paths are already in the tree's relative space.
  const rebase = Boolean(git) && Boolean(tree) && git !== tree;
  const entries: GitStatusEntry[] = [];
  for (const change of changes) {
    const changePosix = change.path.replace(/\\/g, "/");
    const rel = rebase ? posixRelative(tree, `${git}/${changePosix}`) : changePosix;
    if (!rel) continue; // outside the opened subtree, or the root itself
    entries.push({ path: rel, status: gitStatusToPierre(change.status) });
  }
  return entries;
}

function normalizeRoot(root: string | undefined): string {
  return (root ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
}

/** POSIX `relative(fromRoot, abs)` for the "abs is at or under fromRoot" case; null otherwise
 * (escapes upward / unrelated) and for the root itself (empty result). */
function posixRelative(fromRoot: string, abs: string): string | null {
  if (abs === fromRoot) return null;
  if (abs.startsWith(`${fromRoot}/`)) return abs.slice(fromRoot.length + 1);
  return null;
}

/**
 * pi-deck theme tokens that map onto the VS Code-style keys `themeToTreeStyles` reads. We feed
 * resolved CSS custom-property values (`oklch(...)`, valid CSS colours) straight through; the
 * tree's shadow DOM accepts them as-is.
 */
export const TREE_THEME_TOKENS = [
  "--bg-1",
  "--bg-2",
  "--ink-0",
  "--ink-1",
  "--ink-2",
  "--line",
  "--line-strong",
  "--accent-soft",
  "--accent-line",
  "--add",
  "--mod",
  "--del",
] as const;

export type TreeThemeTokenMap = Partial<Record<(typeof TREE_THEME_TOKENS)[number], string>>;

/**
 * Build the `themeToTreeStyles` input from resolved pi-deck token values. `kind` drives
 * `color-scheme` (and Pierre's light/dark hover fallbacks); the rest map onto the sidebar /
 * list / input / git-decoration keys the util consumes.
 */
export function buildTreeThemeInput(
  tokens: TreeThemeTokenMap,
  kind: "light" | "dark",
): TreeThemeInput {
  const t = (name: (typeof TREE_THEME_TOKENS)[number]): string | undefined => {
    const v = tokens[name]?.trim();
    return v ? v : undefined;
  };
  const bg = t("--bg-1");
  const fg = t("--ink-1");
  const colors: Record<string, string> = {};
  const put = (key: string, value: string | undefined): void => {
    if (value) colors[key] = value;
  };
  put("sideBar.background", bg);
  put("sideBar.foreground", fg);
  put("sideBar.border", t("--line"));
  put("list.activeSelectionForeground", t("--ink-0"));
  put("list.hoverBackground", t("--bg-2"));
  put("list.activeSelectionBackground", t("--accent-soft"));
  put("list.focusOutline", t("--accent-line"));
  put("input.background", t("--bg-2"));
  put("input.border", t("--line"));
  put("scrollbarSlider.background", t("--line-strong"));
  put("sideBarSectionHeader.foreground", t("--ink-2"));
  put("gitDecoration.addedResourceForeground", t("--add"));
  put("gitDecoration.modifiedResourceForeground", t("--mod"));
  put("gitDecoration.deletedResourceForeground", t("--del"));
  return { type: kind, bg, fg, colors };
}

/** Read the live values of {@link TREE_THEME_TOKENS} off an element's computed style. */
export function readThemeTokens(el: HTMLElement): TreeThemeTokenMap {
  const computed = getComputedStyle(el);
  const out: TreeThemeTokenMap = {};
  for (const name of TREE_THEME_TOKENS) {
    const value = computed.getPropertyValue(name);
    if (value) out[name] = value.trim();
  }
  return out;
}
