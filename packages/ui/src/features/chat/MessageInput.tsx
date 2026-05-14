import { type KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Mic, Paperclip, Send, Square } from "../../components/icons/index.js";
import { Button } from "../../components/ui/Button.js";
import { IconButton } from "../../components/ui/IconButton.js";
import { Tooltip } from "../../components/ui/Tooltip.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { ContextUsageIndicator } from "./composer/ContextUsageIndicator.js";
import { ExecutionModeMenu } from "./composer/ExecutionModeMenu.js";
import { ModelMenu } from "./composer/ModelMenu.js";
import { useDraftStore } from "./useDraftStore.js";
import { selectTurnInFlight, useMessagesStore } from "./useMessagesStore.js";

const MAX_ROWS = 12;
const LINE_HEIGHT_PX = 20;
const PLACEHOLDER = "Send a message…  (Enter to send, Shift/Ctrl+Enter for newline)";

export function MessageInput({ sessionId }: { sessionId: string }) {
  const [text, setText] = useState("");
  const isInFlight = useMessagesStore(useMemo(() => selectTurnInFlight(sessionId), [sessionId]));
  const sendPrompt = useSessionsStore((s) => s.sendPrompt);
  const cancelPrompt = useSessionsStore((s) => s.cancelPrompt);
  const pendingInsert = useDraftStore((s) => s.pendingInsert);
  const consumePendingInsert = useDraftStore((s) => s.consumePendingInsert);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // "Attach selection to next prompt" pushes through useDraftStore; consume it into the
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
    // Plain Enter sends; Shift+Enter and Ctrl/Cmd+Enter fall through to the browser's
    // default newline behavior.
    if (e.shiftKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    submit();
  };

  const isEmpty = text.trim().length === 0;

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || isInFlight) return;
    setText("");
    void dispatchPrompt(trimmed);
  };

  const dispatchPrompt = async (trimmed: string) => {
    try {
      await sendPrompt(trimmed);
    } catch {
      // Errors surface via toast store from event router; leave text restored to user.
      setText(trimmed);
    }
  };

  return (
    <div className="p-3">
      <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2 focus-within:border-[var(--color-accent)] transition-colors">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={PLACEHOLDER}
          aria-label="Message"
          aria-keyshortcuts="Enter"
          rows={2}
          className="resize-none border-0 bg-transparent px-1 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none font-sans leading-5"
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <ExecutionModeMenu />
            <Tooltip content="Attach files" side="top">
              <IconButton label="Attach files" disabled>
                <Paperclip size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip content="Voice input" side="top">
              <IconButton label="Voice input" disabled>
                <Mic size={14} />
              </IconButton>
            </Tooltip>
          </div>
          <div className="flex items-center gap-1">
            <ModelMenu />
            <ContextUsageIndicator sessionId={sessionId} />
            {isInFlight ? (
              <Button
                variant="danger"
                onClick={() => void cancelPrompt()}
                size="sm"
                aria-label="Stop generating"
              >
                <Square size={12} />
                Stop
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => void submit()}
                disabled={isEmpty}
                size="sm"
                aria-label="Send message"
                title="Enter"
              >
                <Send size={12} />
                Send
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
