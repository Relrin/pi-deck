import type { SessionCommandInfo } from "@pi-deck/core/protocol/commands.js";
import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { filterCommands } from "./useSlashCommandsStore.js";

interface UseSlashAutocompleteArgs {
  text: string;
  setText: (next: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** Known commands for this composer's scope (live session worker, or project disk scan). */
  commands: SessionCommandInfo[] | undefined;
  /** Invoked while a slash token is being typed — fetch/refresh the command list. */
  ensureCommands: () => void;
}

export interface SlashAutocomplete {
  /** Render the SlashCommandMenu while true. */
  open: boolean;
  items: SessionCommandInfo[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  pick: (item: SessionCommandInfo) => void;
  /** The leading token when it names a known command — drives the highlight pill. */
  commandToken: string | null;
  mirrorRef: RefObject<HTMLDivElement | null>;
  /** Attach to the textarea's onScroll; also runs automatically on text changes. */
  syncMirrorScroll: () => void;
  /** Attach to the textarea's onSelect so caret-only moves re-evaluate the token. */
  onSelect: () => void;
  /** Menu keyboard handling. Returns true when the event was consumed. */
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => boolean;
}

/**
 * The whitespace-delimited word containing the caret, when it starts with "/". Works at any
 * position — a leading token will execute as a pi command, a mid-sentence one is a typing
 * aid for referencing skills/templates by name ("what does /skill:foo do?").
 */
function slashWordAtCaret(
  text: string,
  caret: number,
): { query: string; start: number; end: number } | null {
  const clamped = Math.max(0, Math.min(caret, text.length));
  const before = text.slice(0, clamped);
  const start =
    Math.max(before.lastIndexOf(" "), before.lastIndexOf("\n"), before.lastIndexOf("\t")) + 1;
  const typed = before.slice(start);
  if (!typed.startsWith("/")) return null;
  const tail = text.slice(clamped).search(/\s/);
  const end = tail === -1 ? text.length : clamped + tail;
  return { query: typed.slice(1), start, end };
}

/**
 * Shared `/` autocomplete + command-token highlight state machine for both composers
 * (SESSION's MessageInput and the BLANK screen). The menu follows the slash-word under the
 * caret; completion replaces that word. Only a *leading* command is executed by pi, so the
 * highlight pill stays restricted to position 0. The caller renders `SlashCommandMenu` and
 * the mirror div; this hook owns caret tracking, selection, filtering, fetch triggering,
 * and the keyboard protocol.
 */
export function useSlashAutocomplete({
  text,
  setText,
  textareaRef,
  commands,
  ensureCommands,
}: UseSlashAutocompleteArgs): SlashAutocomplete {
  const [caret, setCaret] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateCaret = useCallback(() => {
    const el = textareaRef.current;
    if (el) setCaret(el.selectionStart ?? el.value.length);
  }, [textareaRef]);

  // After every text change the DOM caret is authoritative (covers typing, paste, and the
  // programmatic replacement in pick); onSelect covers caret-only moves (clicks, arrows).
  useEffect(() => {
    void text;
    updateCaret();
  }, [text, updateCaret]);

  const word = useMemo(() => slashWordAtCaret(text, caret), [text, caret]);
  const tokenActive = word !== null;
  const startsWithSlash = text.startsWith("/");
  const items = word ? filterCommands(commands, word.query) : [];
  const open = tokenActive && !dismissed && items.length > 0;

  // Fetch while a slash token is being typed anywhere, and on any leading "/" — the latter
  // so a pasted full command ("/skill:x do it") still gets the list for the highlight.
  useEffect(() => {
    if (tokenActive || startsWithSlash) ensureCommands();
  }, [tokenActive, startsWithSlash, ensureCommands]);

  useEffect(() => {
    if (!tokenActive) setDismissed(false);
    setActiveIndex(0);
  }, [tokenActive]);

  const pick = useCallback(
    (item: SessionCommandInfo) => {
      const current = word;
      if (!current) return;
      const insertion = `/${item.name} `;
      setText(text.slice(0, current.start) + insertion + text.slice(current.end));
      setDismissed(true);
      // React resets the caret to the end after a programmatic value swap; put it right
      // after the inserted command once the new value has been committed to the DOM.
      const pos = current.start + insertion.length;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(pos, pos);
        }
        setCaret(pos);
      });
    },
    [word, text, setText, textareaRef],
  );

  // The leading token when it names a command the agent actually knows. Drives the accent
  // pill the mirror paints underneath the textarea (a textarea can't style partial text).
  // Deliberately position-0 only: pi executes commands solely at the start of a message.
  const commandToken = useMemo(() => {
    if (!startsWithSlash || !commands) return null;
    const ws = text.search(/\s/);
    const token = ws === -1 ? text : text.slice(0, ws);
    if (token.length < 2) return null;
    return commands.some((c) => `/${c.name}` === token) ? token : null;
  }, [text, startsWithSlash, commands]);

  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const syncMirrorScroll = useCallback(() => {
    const mirror = mirrorRef.current;
    const area = textareaRef.current;
    if (mirror && area) mirror.scrollTop = area.scrollTop;
  }, [textareaRef]);
  // Re-sync after every text/highlight change — growth happens in useAutoGrowTextarea's
  // layout effect, and the textarea can auto-scroll on input without firing onScroll.
  // `text` / `commandToken` are signal-only deps (same pattern as useAutoGrowTextarea).
  useEffect(() => {
    void text;
    void commandToken;
    syncMirrorScroll();
  }, [text, commandToken, syncMirrorScroll]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!open) return false;
      const plain = !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if ((e.key === "Enter" || e.key === "Tab") && plain) {
        e.preventDefault();
        const item = items[Math.min(activeIndex, items.length - 1)];
        if (item) pick(item);
        return true;
      }
      if (e.key === "Escape" && plain) {
        // preventDefault also keeps the global Esc-cancels-turn listener quiet.
        e.preventDefault();
        setDismissed(true);
        return true;
      }
      return false;
    },
    [open, items, activeIndex, pick],
  );

  return {
    open,
    items,
    activeIndex: Math.min(activeIndex, Math.max(0, items.length - 1)),
    setActiveIndex,
    pick,
    commandToken,
    mirrorRef,
    syncMirrorScroll,
    onSelect: updateCaret,
    onKeyDown,
  };
}
