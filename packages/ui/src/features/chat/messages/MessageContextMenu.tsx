import * as RadixContextMenu from "@radix-ui/react-context-menu";
import { type ReactNode, useState } from "react";
import { getSelectionText, writeClipboard } from "../../../lib/clipboard.js";
import { cn } from "../../../lib/cn.js";
import { stripMarkdown } from "../../../lib/markdown-strip.js";
import { useToastStore } from "../../_status/useToastStore.js";
import { useDraftStore } from "../useDraftStore.js";

const CONTENT_CLASSES =
  "z-50 min-w-[14rem] rounded-[var(--radius-md)] bg-[var(--color-panel-2)] border border-[var(--color-border)] py-1 shadow-lg";

const ITEM_CLASSES =
  "flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--color-text)] cursor-pointer outline-none data-[highlighted]:bg-[var(--color-panel-hover)] data-[disabled]:text-[var(--color-text-subtle)] data-[disabled]:cursor-not-allowed";

interface MessageContextMenuProps {
  /** The raw markdown source of the message — used by Copy as Markdown / Copy text fallback. */
  rawText: string;
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
export function MessageContextMenu({ rawText, children }: MessageContextMenuProps) {
  const [selectionAtOpen, setSelectionAtOpen] = useState("");
  const insertIntoDraft = useDraftStore((s) => s.insertIntoDraft);
  const push = useToastStore((s) => s.push);

  const hasSelection = selectionAtOpen.trim().length > 0;

  const onCopyText = () => {
    writeClipboard(stripMarkdown(rawText)).catch(() => push("Failed to copy", "error"));
  };

  const onCopyAsMarkdown = () => {
    writeClipboard(rawText).catch(() => push("Failed to copy", "error"));
  };

  const onAttach = () => {
    if (!hasSelection) return;
    insertIntoDraft(selectionAtOpen);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <RadixContextMenu.Root
      onOpenChange={(open) => {
        if (open) setSelectionAtOpen(getSelectionText());
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
