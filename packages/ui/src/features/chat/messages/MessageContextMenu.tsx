import * as RadixContextMenu from "@radix-ui/react-context-menu";
import { type ReactNode, useRef, useState } from "react";
import { getSelectionText, writeClipboard } from "../../../lib/clipboard.js";
import { cn } from "../../../lib/cn.js";
import { stripMarkdown } from "../../../lib/markdown-strip.js";
import { useNotificationStore } from "../../_status/useNotificationStore.js";
import { findPlanCardBody, rangeToOffsets } from "../../plan-panel/planCommentAnchor.js";
import { usePlanCommentsStore } from "../../plan-panel/usePlanCommentsStore.js";
import { useDraftStore } from "../useDraftStore.js";

const CONTENT_CLASSES =
  "z-50 min-w-[14rem] rounded-[var(--radius-md)] bg-[var(--color-panel-2)] border border-[var(--color-border)] py-1 shadow-lg";

const ITEM_CLASSES =
  "flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--color-text)] cursor-pointer outline-none data-[highlighted]:bg-[var(--color-panel-hover)] data-[disabled]:text-[var(--color-text-subtle)] data-[disabled]:cursor-not-allowed";

interface MessageContextMenuProps {
  /** The raw markdown source of the message — used by Copy as Markdown / Copy text fallback. */
  rawText: string;
  /**
   * Set only when this message is a commentable plan card (the latest, complete plan-mode
   * proposal). Enables the "Comment the selection" item, which anchors a pending review
   * comment to the highlighted text. Absent for every other message.
   */
  commentTarget?: { sessionId: string; messageId: string };
  children: ReactNode;
}

/**
 * Right-click menu over a chat message bubble. Replaces the legacy `SelectionToolbar` —
 * delegates positioning, focus, and dismissal to Radix.
 *
 * Both copy actions always copy only the right-clicked message — the global text
 * selection is intentionally ignored so an unrelated highlight elsewhere on the page
 * can't leak into the clipboard.
 *
 * - "Copy text" copies the message body with markdown stripped.
 * - "Copy as Markdown" copies the raw markdown body.
 * - "Attach selection to next prompt" is the only action that consumes the selection;
 *   it's disabled when no selection exists at the moment the menu opens.
 */
export function MessageContextMenu({ rawText, commentTarget, children }: MessageContextMenuProps) {
  const [selectionAtOpen, setSelectionAtOpen] = useState("");
  // The selection's live Range, cloned at menu-open (Radix closing the menu would clear the
  // live selection). Used by "Comment the selection" to derive offsets relative to the card.
  const rangeAtOpen = useRef<Range | null>(null);
  const insertIntoDraft = useDraftStore((s) => s.insertIntoDraft);
  const notifyError = useNotificationStore((s) => s.error);

  const hasSelection = selectionAtOpen.trim().length > 0;

  const onCopyText = () => {
    writeClipboard(stripMarkdown(rawText)).catch(() => notifyError("Failed to copy"));
  };

  const onCopyAsMarkdown = () => {
    writeClipboard(rawText).catch(() => notifyError("Failed to copy"));
  };

  const onAttach = () => {
    if (!hasSelection) return;
    insertIntoDraft(selectionAtOpen);
    window.getSelection()?.removeAllRanges();
  };

  // Anchor a pending review comment to the highlighted plan text. Maps the cloned selection
  // Range to character offsets within the plan card body so the highlight survives re-renders.
  const onComment = () => {
    if (!commentTarget) return;
    const range = rangeAtOpen.current;
    if (!range) return;
    const root = findPlanCardBody(range.commonAncestorContainer);
    if (!root) return;
    const offsets = rangeToOffsets(root, range);
    if (!offsets) return;
    const quote = range.toString().trim();
    if (!quote) return;
    usePlanCommentsStore.getState().startDraft(commentTarget.sessionId, {
      messageId: commentTarget.messageId,
      quote,
      start: offsets.start,
      end: offsets.end,
    });
    window.getSelection()?.removeAllRanges();
  };

  // "Comment the selection" only makes sense on a plan card with a live selection that sits
  // inside the card body.
  const canComment =
    !!commentTarget &&
    hasSelection &&
    !!rangeAtOpen.current &&
    !!findPlanCardBody(rangeAtOpen.current.commonAncestorContainer);

  return (
    <RadixContextMenu.Root
      onOpenChange={(open) => {
        if (open) {
          setSelectionAtOpen(getSelectionText());
          const sel = window.getSelection();
          rangeAtOpen.current =
            sel && sel.rangeCount > 0 && !sel.isCollapsed ? sel.getRangeAt(0).cloneRange() : null;
        }
      }}
    >
      <RadixContextMenu.Trigger asChild>{children}</RadixContextMenu.Trigger>
      <RadixContextMenu.Portal>
        <RadixContextMenu.Content className={CONTENT_CLASSES}>
          <RadixContextMenu.Item className={cn(ITEM_CLASSES)} onSelect={onCopyText}>
            Copy text
          </RadixContextMenu.Item>
          <RadixContextMenu.Item className={cn(ITEM_CLASSES)} onSelect={onCopyAsMarkdown}>
            Copy as Markdown
          </RadixContextMenu.Item>
          {commentTarget && (
            <RadixContextMenu.Item
              className={cn(ITEM_CLASSES)}
              disabled={!canComment}
              onSelect={onComment}
            >
              Comment the selection
            </RadixContextMenu.Item>
          )}
          <RadixContextMenu.Item
            className={cn(ITEM_CLASSES)}
            disabled={!hasSelection}
            onSelect={onAttach}
          >
            Attach selection to next prompt
          </RadixContextMenu.Item>
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  );
}
