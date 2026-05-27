import type { Dirent } from "node:fs";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import ignore, { type Ignore } from "ignore";
import type { FsNode } from "./types.js";

/**
 * Directories the walker hides unconditionally — independent of any `.gitignore`. `.git/`
 * is dropped because it's huge and meaningless to the user. Anything else the user wants
 * hidden should go in their `.gitignore`, which we honour below.
 */
const ALWAYS_HIDDEN: ReadonlySet<string> = new Set([".git"]);

export interface WalkOptions {
  /** Cap on the number of files walked. Default 50 000. */
  maxFiles?: number;
}

/**
 * Walks the project directory, building an in-memory tree, while applying ignore rules from:
 * - `.gitignore` files at every directory level (deeper files extend the rule set)
 * - `.git/info/exclude` (per-repo private excludes)
 * - The `ALWAYS_HIDDEN` set above
 *
 * Returns the children of `root` (not a wrapping root node); callers render them as the
 * top-level tree directly. Absolute paths are normalised to forward slashes so the renderer
 * doesn't need platform-specific joins.
 */
export async function walkProject(root: string, opts: WalkOptions = {}): Promise<FsNode[]> {
  const absRoot = resolve(root);
  const rootPatterns = await collectRootPatterns(absRoot);
  const counter = { files: 0, cap: opts.maxFiles ?? 50_000 };
  const followed = new Set<string>();
  return walkDir(absRoot, absRoot, rootPatterns, buildMatcher(rootPatterns), counter, followed);
}

interface Counter {
  files: number;
  cap: number;
}

async function walkDir(
  dir: string,
  root: string,
  parentPatterns: string[],
  parentMatcher: Ignore,
  counter: Counter,
  followed: Set<string>,
): Promise<FsNode[]> {
  if (counter.files >= counter.cap) return [];

  // TS resolves the `readdir` overload to `Dirent<Buffer>` unless we narrow explicitly.
  // The runtime returns string-named entries; the annotation just sidesteps overload pick.
  let entries: Dirent[];
  try {
    entries = (await readdir(dir, { withFileTypes: true, encoding: "utf8" })) as Dirent[];
  } catch {
    return [];
  }

  // Stack a local `.gitignore` on top of the parent rules so deeper-level patterns apply only
  // to children of this dir. We rebuild the matcher just once per directory that carries
  // its own ignore file — otherwise the parent matcher is reused as-is.
  let patterns = parentPatterns;
  let matcher = parentMatcher;
  const localIgnore = entries.find((e) => e.name === ".gitignore" && e.isFile());
  if (localIgnore) {
    const text = await readFileSafe(join(dir, ".gitignore"));
    if (text && text.trim().length > 0) {
      patterns = [...parentPatterns, text];
      matcher = buildMatcher(patterns);
    }
  }

  const nodes: FsNode[] = [];
  for (const entry of entries) {
    if (ALWAYS_HIDDEN.has(entry.name)) continue;

    const absPath = join(dir, entry.name);
    const rel = relative(root, absPath);
    const relPosix = toPosix(rel);
    // `ignore` matches against forward-slash paths; mirror git by suffixing directories with
    // `/` so directory-only patterns (`dist/`) match.
    const matchKey = entry.isDirectory() ? `${relPosix}/` : relPosix;
    if (matcher.ignores(matchKey)) continue;

    if (entry.isSymbolicLink()) {
      const node = await buildSymlinkNode(absPath, root, followed);
      if (node) nodes.push(node);
      continue;
    }

    if (entry.isDirectory()) {
      const dirChildren = await walkDir(absPath, root, patterns, matcher, counter, followed);
      nodes.push({
        path: toPosix(absPath),
        name: entry.name,
        type: "dir",
        relPath: relPosix,
        children: dirChildren,
      });
      continue;
    }

    if (entry.isFile()) {
      if (counter.files >= counter.cap) continue;
      counter.files += 1;
      nodes.push({
        path: toPosix(absPath),
        name: entry.name,
        type: "file",
        relPath: relPosix,
      });
    }
  }

  // Folders before files, alphabetical within each section — the conventional explorer layout.
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
  return nodes;
}

async function collectRootPatterns(root: string): Promise<string[]> {
  const out: string[] = [];
  const rootIgnore = await readFileSafe(join(root, ".gitignore"));
  if (rootIgnore && rootIgnore.trim().length > 0) out.push(rootIgnore);
  const infoExclude = await readFileSafe(join(root, ".git", "info", "exclude"));
  if (infoExclude && infoExclude.trim().length > 0) out.push(infoExclude);
  return out;
}

function buildMatcher(patterns: string[]): Ignore {
  const m = ignore();
  for (const text of patterns) m.add(text);
  return m;
}

async function readFileSafe(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

async function buildSymlinkNode(
  absPath: string,
  root: string,
  followed: Set<string>,
): Promise<FsNode | undefined> {
  let target: string;
  try {
    target = await realpath(absPath);
  } catch {
    return undefined;
  }
  let isDir = false;
  try {
    const s = await stat(absPath);
    isDir = s.isDirectory();
  } catch {
    return undefined;
  }
  const name = absPath.split(/[\\/]/).at(-1) ?? absPath;
  const rel = toPosix(relative(root, absPath));
  // Cycle protection: don't traverse the same realpath twice. We still emit the link node so
  // the user sees the symlink — it just won't carry expandable children.
  followed.add(target);
  return {
    path: toPosix(absPath),
    name,
    type: isDir ? "dir" : "file",
    relPath: rel,
    linkedTo: toPosix(target),
  };
}

function toPosix(p: string): string {
  if (sep === "/") return p;
  return p.split(sep).join("/");
}
