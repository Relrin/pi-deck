import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { GitCommandError, runGit } from "./runner.js";

export type DiffBaseline = "HEAD" | { kind: "stash"; sha: string };

export type DiffStatus = "M" | "A" | "D";

export interface FileDiff {
  /** Unified diff text (`git diff <baseline> -- <path>`). Empty string for an untracked
   * added file where git has no diff to produce. */
  unified: string;
  /** Pre-image content. `null` when the file did not exist at the baseline. */
  before: string | null;
  /** Post-image content. `null` when the file no longer exists in the working tree. */
  after: string | null;
  status: DiffStatus;
}

/**
 * Read the diff for a single repo-relative path between `baseline` and the current
 * working tree. The renderer feeds this directly into Pierre — we hand back both the
 * unified patch (Pierre's preferred input) and the raw before/after contents so callers
 * can also build a before/after side-by-side without re-parsing.
 *
 * For untracked files at HEAD we synthesise the diff manually: git's own diff command
 * won't produce a patch unless the path is at least intent-to-add, and forcing the user
 * through `git add -N` just to render a viewer is a bad trade.
 */
export async function diffForPath(
  root: string,
  path: string,
  baseline: DiffBaseline,
): Promise<FileDiff> {
  const baselineRef = baseline === "HEAD" ? "HEAD" : baseline.sha;
  const before = await readBaseline(root, path, baselineRef);
  const after = await readWorkingTree(root, path);
  const status = classify(before, after);

  let unified = "";
  if (status === "M" || status === "D") {
    unified = await readUnified(root, path, baselineRef);
  } else if (status === "A") {
    // No baseline blob to diff against — synthesise an all-additions patch so Pierre
    // has something to render. Empty when the file is also empty on disk.
    unified = synthesiseAddPatch(path, after ?? "");
  }

  return { unified, before, after, status };
}

async function readBaseline(root: string, path: string, ref: string): Promise<string | null> {
  try {
    const { stdout } = await runGit(root, ["show", `${ref}:${path}`]);
    return stdout;
  } catch (err) {
    if (err instanceof GitCommandError) {
      // "fatal: path 'x' exists on disk, but not in 'HEAD'" — file was untracked at
      // baseline. Treat as nonexistent.
      return null;
    }
    throw err;
  }
}

async function readWorkingTree(root: string, path: string): Promise<string | null> {
  try {
    return await readFile(resolve(root, path), "utf8");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return null;
    throw err;
  }
}

async function readUnified(root: string, path: string, ref: string): Promise<string> {
  try {
    const { stdout } = await runGit(root, ["diff", ref, "--no-color", "--no-renames", "--", path]);
    return stdout;
  } catch (err) {
    if (err instanceof GitCommandError) return "";
    throw err;
  }
}

function classify(before: string | null, after: string | null): DiffStatus {
  if (before === null && after !== null) return "A";
  if (before !== null && after === null) return "D";
  return "M";
}

function synthesiseAddPatch(path: string, content: string): string {
  if (content.length === 0) {
    return `--- /dev/null\n+++ b/${path}\n`;
  }
  const lines = content.split(/\r?\n/);
  // Trailing newline on the file means the split produced an empty final element we
  // don't want to emit as a separate hunk line.
  const trailingNewline = content.endsWith("\n");
  const effective = trailingNewline ? lines.slice(0, -1) : lines;
  const header = `--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${effective.length} @@\n`;
  const body = effective.map((line) => `+${line}`).join("\n");
  return trailingNewline ? `${header}${body}\n` : `${header}${body}`;
}
