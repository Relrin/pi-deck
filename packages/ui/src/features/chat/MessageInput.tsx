import { type KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Send, Square } from "../../components/icons/index.js";
import { Button } from "../../components/ui/Button.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { useDraftStore } from "./useDraftStore.js";
import { selectTurnInFlight, useMessagesStore } from "./useMessagesStore.js";

const MAX_ROWS = 12;

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
    const lineHeight = 20;
    const maxHeight = lineHeight * MAX_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [text]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  };

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
          placeholder="Send a message…  (Ctrl/Cmd+Enter to send, Shift+Enter or Enter for newline)"
          rows={2}
          className="flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-[var(--color-accent)] font-sans leading-5"
        />
        {isInFlight ? (
          <Button variant="danger" onClick={cancelPrompt} size="md">
            <Square size={14} />
            Stop
          </Button>
        ) : (
          <Button variant="primary" onClick={submit} disabled={!text.trim()} size="md">
            <Send size={14} />
            Send
          </Button>
        )}
      </div>
    </div>
  );
}
