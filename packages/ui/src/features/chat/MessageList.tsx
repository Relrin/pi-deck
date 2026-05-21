import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  MESSAGE_LIST_ESTIMATE_PX,
  MESSAGE_LIST_STICKY_THRESHOLD_PX,
} from "../../lib/ui-constants.js";
import { AssistantMessage } from "./messages/AssistantMessage.js";
import { UserMessage } from "./messages/UserMessage.js";
import type { MessageEntry } from "./types.js";
import { selectMessages, useMessagesStore } from "./useMessagesStore.js";
import { useScrollPositionStore } from "./useScrollPositionStore.js";

/**
 * Pi sometimes terminates an agent loop with a trailing `message_update` that carries an
 * empty snapshot (`content: []`) and is then closed out by `turn_end`. The store dutifully
 * materialises that into an assistant entry — but with no text and no attached tool calls,
 * the only thing visible would be the "MODEL · HH:MM:SS" tag row, dangling at the bottom
 * of the chat. Hide those completed empties at the render layer so they don't show up as
 * mysterious time-only stubs. While still streaming, the bubble can stay (it'll be filled
 * in or surface a StreamingStatus indicator inside AssistantMessage).
 */
export function isRenderableMessage(m: MessageEntry): boolean {
  if (m.kind !== "assistant") return true;
  if (!m.isComplete) return true;
  return m.text.length > 0 || m.toolCallIds.length > 0;
}

export function MessageList({ sessionId }: { sessionId: string }) {
  const allMessages = useMessagesStore(useMemo(() => selectMessages(sessionId), [sessionId]));
  const messages = useMemo(() => allMessages.filter(isRenderableMessage), [allMessages]);
  const parentRef = useRef<HTMLDivElement | null>(null);
  // Initialise from the saved snapshot so the stick-to-bottom layout effect below sees
  // the right value on first commit. Without this, the effect would run with a stale
  // `true` and unconditionally pin to the bottom — clobbering the saved-offset restore.
  const [stickToBottom, setStickToBottom] = useState<boolean>(
    () => useScrollPositionStore.getState().get(sessionId)?.atBottom !== false,
  );
  // Re-sync `stickToBottom` when `sessionId` changes by updating state during render
  // ("adjusting state when a prop changes"). React discards the in-flight render and
  // re-runs synchronously with the new value, so subsequent effects see it on first commit.
  const prevSessionIdRef = useRef(sessionId);
  if (prevSessionIdRef.current !== sessionId) {
    prevSessionIdRef.current = sessionId;
    setStickToBottom(useScrollPositionStore.getState().get(sessionId)?.atBottom !== false);
  }
  const snapshotScroll = useScrollPositionStore((s) => s.snapshot);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => MESSAGE_LIST_ESTIMATE_PX,
    overscan: 4,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // Restore the saved scroll position (or pin to bottom) when switching sessions.
  // The "pin to bottom" path defers to `virtualizer.scrollToIndex` because raw
  // `el.scrollTop = el.scrollHeight` lands above the true bottom with dynamic-height
  // virtual rows: getTotalSize() is stale until measureElement reports real heights.
  // scrollToIndex hooks into the virtualizer's measurement loop and converges.
  // biome-ignore lint/correctness/useExhaustiveDependencies: session-switch only
  useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const saved = useScrollPositionStore.getState().get(sessionId);
    if (saved?.atBottom === false) {
      el.scrollTop = saved.offset;
      return;
    }
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end", behavior: "auto" });
    }
  }, [sessionId]);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distanceFromBottom < MESSAGE_LIST_STICKY_THRESHOLD_PX;
      setStickToBottom(atBottom);
      snapshotScroll(sessionId, { offset: el.scrollTop, atBottom });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [sessionId, snapshotScroll]);

  // Snapshot on unmount so a quick re-mount (e.g. resize remount) still restores correctly.
  useEffect(() => {
    return () => {
      const el = parentRef.current;
      if (!el) return;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      snapshotScroll(sessionId, {
        offset: el.scrollTop,
        atBottom: distanceFromBottom < MESSAGE_LIST_STICKY_THRESHOLD_PX,
      });
    };
  }, [sessionId, snapshotScroll]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on every message change
  useLayoutEffect(() => {
    if (!stickToBottom) return;
    if (messages.length === 0) return;
    virtualizer.scrollToIndex(messages.length - 1, { align: "end", behavior: "auto" });
  }, [messages, stickToBottom]);

  const items = virtualizer.getVirtualItems();

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={parentRef}
        className="pid-chat-body absolute inset-0 overflow-y-auto"
        data-testid="message-list-scroll"
      >
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}
        >
          {items.map((virtualRow) => {
            const message = messages[virtualRow.index];
            if (!message) return null;
            return (
              <div
                key={message.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                  padding: "8px 0",
                }}
              >
                {message.kind === "user" ? (
                  <UserMessage message={message} />
                ) : (
                  <AssistantMessage message={message} sessionId={sessionId} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      {!stickToBottom && (
        <button
          type="button"
          onClick={() => {
            setStickToBottom(true);
            if (messages.length > 0) {
              virtualizer.scrollToIndex(messages.length - 1, { align: "end", behavior: "auto" });
            }
          }}
          className="pid-jump-latest"
          aria-label="Jump to latest message"
        >
          <span aria-hidden>↓</span>
          <span>Jump to latest</span>
        </button>
      )}
    </div>
  );
}
