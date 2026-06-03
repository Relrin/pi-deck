import { type FileDiffMetadata, parseDiffFromFile } from "@pierre/diffs";
import type { ToolCallEntry } from "../types.js";

/**
 * A parsed file diff for an `edit` / `write` tool call, ready to feed straight into Pierre's
 * `<FileDiff>` (via `DiffView`) and to render the `+add −del` counts in the card header.
 *
 * `add` / `del` are summed from the same `fileDiff` the body renders, so the header counts
 * and the expanded diff can never disagree.
 */
export interface ToolFileDiff {
  /** Repo-relative path the tool wrote to. */
  path: string;
  /** Pierre's parsed diff metadata (built from the before/after contents via jsdiff). */
  fileDiff: FileDiffMetadata;
  add: number;
  del: number;
}

interface EditInput {
  path?: string;
  edits?: { oldText?: string; newText?: string }[];
}

interface WriteInput {
  path?: string;
  content?: string;
}

/** True for the two tools that render as an expandable file diff. */
export function isFileDiffTool(name: string): boolean {
  return name === "edit" || name === "write";
}

// Parsing runs jsdiff over the before/after text. `deriveToolFileDiff` is called from both the
// card header and the expanded body, and re-runs on unrelated re-renders, so memoise per
// (immutable) call object to avoid recomputing the same diff.
const cache = new WeakMap<ToolCallEntry, ToolFileDiff | null>();

/**
 * Build the file-diff view for a settled `edit` / `write` call, or `null` when one isn't
 * meaningful (still running, errored, no change, missing args). Callers fall back to their
 * default rendering on `null`.
 *
 * We diff the tool's own `input` rather than pi's `result` (or git): the edit tool's
 * `oldText` → `newText` (or write's full `content`) is the exact change, is always present
 * (including on a resumed session, where `input` is the persisted tool arguments), and
 * doesn't depend on the current working-tree state. pi's own `result.details.diff` is a TUI
 * display format — not a parseable patch — so it can't be fed to Pierre directly.
 */
export function deriveToolFileDiff(call: ToolCallEntry): ToolFileDiff | null {
  const cached = cache.get(call);
  if (cached !== undefined) return cached;
  const result = compute(call);
  cache.set(call, result);
  return result;
}

function compute(call: ToolCallEntry): ToolFileDiff | null {
  // Only a settled success has a real before→after to show. A running edit's args may still
  // be streaming; an errored edit wrote nothing, so a diff would misrepresent what happened.
  if (call.status !== "done") return null;

  if (call.name === "edit") {
    const input = (call.input ?? {}) as EditInput;
    const path = input.path;
    const edits = Array.isArray(input.edits) ? input.edits : [];
    if (!path || edits.length === 0) return null;
    // Multiple edits target different file regions; join them into one synthetic before/after
    // so Pierre shows each changed region. Single edits (the common case) are exact.
    const before = edits.map((e) => e.oldText ?? "").join("\n");
    const after = edits.map((e) => e.newText ?? "").join("\n");
    return build(path, before, after);
  }

  if (call.name === "write") {
    const input = (call.input ?? {}) as WriteInput;
    const path = input.path;
    if (!path || typeof input.content !== "string" || input.content.length === 0) return null;
    // A fresh write has no baseline — diff against an empty file so it reads as all-additions.
    return build(path, "", input.content);
  }

  return null;
}

function build(path: string, before: string, after: string): ToolFileDiff | null {
  if (before === after) return null;
  const fileDiff = parseDiffFromFile(
    { name: path, contents: before },
    { name: path, contents: after },
  );
  let add = 0;
  let del = 0;
  for (const hunk of fileDiff.hunks) {
    add += hunk.additionLines;
    del += hunk.deletionLines;
  }
  return { path, fileDiff, add, del };
}
