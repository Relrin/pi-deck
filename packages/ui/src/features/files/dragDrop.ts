import type { PromptAttachment } from "@pi-deck/core/protocol/commands.js";
import type { VisibleRow } from "./useFileTreeStore.js";

/**
 * Custom MIME type used for in-app drag-n-drop from the file tree to the chat composer.
 * We use a `application/x-pideck-*` MIME so OS-level drag handlers don't try to claim the
 * drop and the composer doesn't confuse file-tree drags with OS file drops.
 */
export const PIDECK_PATHS_MIME = "application/x-pideck-paths";

export interface PideckPathsPayload {
  /** Attachments in send-ready shape — the composer can push these straight into
   * `useIntroComposerStore.addAttachments`. */
  attachments: PromptAttachment[];
}

export function encodePideckPaths(attachments: PromptAttachment[]): string {
  return JSON.stringify({ attachments } satisfies PideckPathsPayload);
}

export function decodePideckPaths(raw: string): PromptAttachment[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return [];
    const attachments = (parsed as { attachments?: unknown }).attachments;
    if (!Array.isArray(attachments)) return [];
    const result: PromptAttachment[] = [];
    for (const entry of attachments) {
      if (!entry || typeof entry !== "object") continue;
      const kind = (entry as { kind?: unknown }).kind;
      const path = (entry as { path?: unknown }).path;
      if (typeof path !== "string" || path.length === 0) continue;
      if (kind !== "file" && kind !== "folder" && kind !== "repo-ref") continue;
      result.push({ kind, path });
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * Cheap detection: returns `true` when the dragged payload carries our custom MIME, used
 * to pop the composer's "Drop to attach" overlay without committing to a parse.
 */
export function hasPideckPaths(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer) return false;
  // DataTransfer.types is readonly DOMStringList in some browsers — coerce to array first.
  const types = Array.from(dataTransfer.types ?? []);
  return types.includes(PIDECK_PATHS_MIME);
}

/**
 * Build the drag payload for a row plus (optionally) its surrounding selection.
 *
 * If the dragged row is already in `selectedPaths` (and the selection has more than one
 * entry), drag the whole selection so the user's bulk-pick flows through to the composer.
 * Otherwise drag the single row.
 *
 * `nodeTypeByPath` is a lookup from path → "file" | "dir" so we can emit per-path `kind`
 * tags. Anything not in the map falls back to "file"; the composer treats unrecognised
 * kinds as files anyway.
 *
 * Lives in `dragDrop.ts` rather than the row component so HMR Fast Refresh stays happy
 * (component files should export only components).
 */
export function buildDragPayload(
  draggedRow: VisibleRow,
  selectedPaths: Set<string>,
  nodeTypeByPath: Map<string, "file" | "dir">,
): { mimePayload: string; rowCount: number } {
  const paths =
    selectedPaths.size > 1 && selectedPaths.has(draggedRow.path)
      ? [...selectedPaths]
      : [draggedRow.path];
  const attachments = paths.map((path) => {
    const type = nodeTypeByPath.get(path) ?? draggedRow.node.type;
    const kind: PromptAttachment["kind"] = type === "dir" ? "folder" : "file";
    return { kind, path };
  });
  const mimePayload = encodePideckPaths(attachments);
  return { mimePayload, rowCount: paths.length };
}
