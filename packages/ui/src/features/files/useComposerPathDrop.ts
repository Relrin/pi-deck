import type { PromptAttachment } from "@pi-deck/core/protocol/commands.js";
import { type DragEvent, useCallback, useRef, useState } from "react";
import { decodePideckPaths, hasPideckPaths, PIDECK_PATHS_MIME } from "./dragDrop.js";

interface UseComposerPathDropArgs {
  onAttachments: (next: PromptAttachment[]) => void;
}

interface UseComposerPathDropResult {
  /** True while a pideck-paths drag is hovering the composer; renderers use it to show
   * the "Drop to attach" overlay. */
  dragOver: boolean;
  /** Returns `true` if the event was handled (our MIME). Callers should fall through to
   * image-drop handlers only when this returns `false`. */
  onDrop: (event: DragEvent<HTMLElement>) => boolean;
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => boolean;
}

/**
 * Composer-side handler for the file-tree drag MIME. Intentionally narrow: it only ever
 * fires for `application/x-pideck-paths`; OS-file drops and image pastes continue to flow
 * through `useImagePaste`.
 *
 * Drag-depth is tracked so nested dragEnter/dragLeave events from child nodes don't flicker
 * the overlay — same pattern used by MessageInput for its image-drop overlay.
 */
export function useComposerPathDrop({
  onAttachments,
}: UseComposerPathDropArgs): UseComposerPathDropResult {
  const [dragOver, setDragOver] = useState(false);
  const depthRef = useRef(0);

  const onDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
    if (!hasPideckPaths(event.dataTransfer)) return;
    depthRef.current += 1;
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    if (depthRef.current === 0) return;
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) setDragOver(false);
  }, []);

  const onDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (!hasPideckPaths(event.dataTransfer)) return false;
    // preventDefault is required to make the element a valid drop target. We mark the effect
    // as "copy" because we're never moving paths — the file tree keeps the original entries.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    return true;
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!hasPideckPaths(event.dataTransfer)) return false;
      const raw = event.dataTransfer?.getData(PIDECK_PATHS_MIME) ?? "";
      const attachments = decodePideckPaths(raw);
      event.preventDefault();
      depthRef.current = 0;
      setDragOver(false);
      if (attachments.length > 0) onAttachments(attachments);
      return true;
    },
    [onAttachments],
  );

  return { dragOver, onDrop, onDragEnter, onDragLeave, onDragOver };
}
