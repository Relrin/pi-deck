import { type KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Send, Square } from "../../components/icons/index.js";
import { Button } from "../../components/ui/Button.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { useDraftStore } from "./useDraftStore.js";
import { selectTurnInFlight, useMessagesStore } from "./useMessagesStore.js";

const MAX_ROWS = 12;
const LINE_HEIGHT_PX = 20;
const PLACEHOLDER = "Send a message…  (Ctrl/Cmd+Enter to send, Enter or Shift+Enter for newline)";

export function MessageInput({ sessionId }: { sessionId: string }) {
  const [text, setText] = useState("");
  const isInFlight = useMessagesStore(useMemo(() => selectTurnInFlight(sessionId), [sessionId]));
  const sendPrompt = useSessionsStore((s) => s.sendPrompt);
  const cancelPrompt = useSessionsStore((s) => s.cancelPrompt);
  const pendingInsert = useDraftStore((s) => s.pendingInsert);
  const consumePendingInsert = useDraftStore((s) => s.consumePendingInsert);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // "Attach selection to context" pushes through useDraftStore; consume it into the
  // local textarea state so the user can edit before sending.
  useEffect(() => {
    if (pendingInsert === undefined) return;
    const value = consumePendingInsert();
    if (value === undefined) return;
    setText((prev) => {
      if (!prev) return value;
      const separator = prev.endsWith("\n") ? "" : "\n";
      return `${prev}${separator}${value}`;
    });
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, [pendingInsert, consumePendingInsert]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure height when the typed text changes
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = LINE_HEIGHT_PX * MAX_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [text]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
    // Cmd/Ctrl+Enter sends; Shift+Enter inserts a newline; Enter alone inserts a newline.
    // Plain Enter intentionally does *not* submit — too easy to mis-fire mid-thought.
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      void submit();
    }
    // Shift+Enter and plain Enter fall through to the browser's default newline.
  };

  const isEmpty = text.trim().length === 0;

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || isInFlight) return;
    setText("");
    try {
      await sendPrompt(trimmed);
    } catch {
      // Errors surface via toast store from event router; leave text restored to user.
      setText(trimmed);
    }
  };

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <div className="flex gap-2 items-end">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={PLACEHOLDER}
          aria-label="Message"
          aria-keyshortcuts="Control+Enter Meta+Enter"
          rows={2}
          className="flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] transition-colors focus:outline-none focus:border-[var(--color-accent)] font-sans leading-5"
        />
        {isInFlight ? (
          <Button
            variant="danger"
            onClick={() => void cancelPrompt()}
            size="md"
            aria-label="Stop generating"
          >
            <Square size={14} />
            Stop
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => void submit()}
            disabled={isEmpty}
            size="md"
            aria-label="Send message"
            title="Ctrl/Cmd+Enter"
          >
            <Send size={14} />
            Send
          </Button>
        )}
      </div>
    </div>
  );
}
