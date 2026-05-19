import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Send, Square } from "../../components/icons/index.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { ContextUsageIndicator } from "./composer/ContextUsageIndicator.js";
import { SessionAgentModePicker } from "./composer/SessionAgentModePicker.js";
import { SessionEffortPicker } from "./composer/SessionEffortPicker.js";
import { SessionModelPicker } from "./composer/SessionModelPicker.js";
import { useComposerStore } from "./composer/useComposerStore.js";
import { useDraftStore } from "./useDraftStore.js";
import { selectTurnInFlight, useMessagesStore } from "./useMessagesStore.js";

const PLACEHOLDER = "Send a message…  @ files · / commands · ! shell";

export function MessageInput({ sessionId }: { sessionId: string }) {
  const [text, setText] = useState("");
  const isInFlight = useMessagesStore(useMemo(() => selectTurnInFlight(sessionId), [sessionId]));
  const sendPrompt = useSessionsStore((s) => s.sendPrompt);
  const cancelPrompt = useSessionsStore((s) => s.cancelPrompt);
  const executionMode = useComposerStore((s) => s.executionMode);
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

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
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
      await sendPrompt(trimmed, { agentMode: executionMode });
    } catch {
      setText(trimmed);
    }
  };

  return (
    <div className="pid-chat-composer">
      <div className="pid-composer-shell">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={PLACEHOLDER}
          aria-label="Message"
          aria-keyshortcuts="Enter"
          rows={3}
          className="pid-composer-input"
        />
        <div className="pid-composer-row">
          <SessionAgentModePicker />
          <button
            type="button"
            className="pid-picker-trigger pid-picker-trigger-icon-only"
            aria-label="Attach (coming soon)"
            disabled
          >
            <Paperclip size={14} aria-hidden />
          </button>
          <span className="pid-composer-row-spacer" />
          <ContextUsageIndicator sessionId={sessionId} />
          <SessionModelPicker sessionId={sessionId} />
          <SessionEffortPicker sessionId={sessionId} />
          {isInFlight ? (
            <button
              type="button"
              onClick={() => void cancelPrompt()}
              className="pid-composer-stop"
              aria-label="Stop generating"
            >
              <Square size={12} aria-hidden />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={isEmpty}
              className="pid-composer-send"
              aria-label="Send message"
              title="Enter"
            >
              <Send size={12} aria-hidden />
              <span>Send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
