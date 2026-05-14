import { useEffect, useRef, useState } from "react";
import { getSelectionText, writeClipboard } from "../../lib/clipboard.js";
import { cn } from "../../lib/cn.js";
import { useToastStore } from "../_status/useToastStore.js";
import { useDraftStore } from "./useDraftStore.js";

interface MenuState {
  /** Anchor point in viewport coords (the right-click position). */
  x: number;
  y: number;
  /** Plain text the user highlighted. */
  selection: string;
  /** Raw markdown source of the enclosing message. */
  rawText: string;
}

const MARGIN = 8;
const APPROX_WIDTH = 220;
const APPROX_HEIGHT = 120;

/**
 * Right-click context menu over a selection inside a message marked with
 * `data-selectable-message`. Behaves like a native context menu: the user selects
 * text first, then opens the menu via right-click. Mirrors Claude's selection menu UX.
 */
export function SelectionToolbar() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const insertIntoDraft = useDraftStore((s) => s.insertIntoDraft);
  const push = useToastStore((s) => s.push);

  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return;
      }
      const text = selection.toString();
      if (!text.trim()) return;

      const range = selection.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const startEl =
        node.nodeType === Node.ELEMENT_NODE ? (node as Element) : (node.parentElement ?? undefined);
      const messageEl = startEl?.closest("[data-selectable-message]");
      if (!messageEl) {
        // Selection isn't inside a chat message — let the native menu through.
        return;
      }

      e.preventDefault();
      setMenu({
        x: e.clientX,
        y: e.clientY,
        selection: text,
        rawText: messageEl.getAttribute("data-message-raw") ?? "",
      });
    }

    function onMouseDownAnywhere(e: MouseEvent) {
      if (!ref.current) return;
      if (e.target instanceof Node && ref.current.contains(e.target)) return;
      setMenu(null);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(null);
    }

    function onScrollOrResize() {
      setMenu(null);
    }

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("mousedown", onMouseDownAnywhere);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("mousedown", onMouseDownAnywhere);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, []);

  if (!menu) return null;

  // Clamp to viewport.
  const left = Math.max(MARGIN, Math.min(window.innerWidth - APPROX_WIDTH - MARGIN, menu.x));
  const top = Math.max(MARGIN, Math.min(window.innerHeight - APPROX_HEIGHT - MARGIN, menu.y));

  const close = () => setMenu(null);

  const onCopyMessage = (e: React.MouseEvent) => {
    e.preventDefault();
    writeClipboard(stripMarkdown(menu.rawText)).catch(() => push("Failed to copy", "error"));
    close();
  };
  const onCopyAsMarkdown = (e: React.MouseEvent) => {
    e.preventDefault();
    writeClipboard(menu.rawText).catch(() => push("Failed to copy", "error"));
    close();
  };
  const onAttach = (e: React.MouseEvent) => {
    e.preventDefault();
    const selectionNow = getSelectionText() || menu.selection;
    insertIntoDraft(selectionNow);
    window.getSelection()?.removeAllRanges();
    close();
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Selection actions"
      style={{ position: "fixed", top, left, zIndex: 60 }}
      className="flex min-w-[12rem] flex-col rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-panel-2)] py-1 text-sm shadow-lg"
      onMouseDown={(e) => e.preventDefault()}
    >
      <MenuItem onMouseDown={onCopyMessage}>Copy message</MenuItem>
      <MenuItem onMouseDown={onCopyAsMarkdown}>Copy as Markdown</MenuItem>
      <MenuItem onMouseDown={onAttach}>Attach selection as context</MenuItem>
    </div>
  );
}

function MenuItem({
  children,
  onMouseDown,
}: {
  children: React.ReactNode;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onMouseDown={onMouseDown}
      className={cn(
        "w-full px-3 py-1.5 text-left text-[var(--color-text)] hover:bg-[var(--color-panel-hover)] focus-visible:outline-none focus-visible:bg-[var(--color-panel-hover)]",
      )}
    >
      {children}
    </button>
  );
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```[a-z]*\n?|```/gi, ""))
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}
