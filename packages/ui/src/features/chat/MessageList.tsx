import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  MESSAGE_LIST_ESTIMATE_PX,
  MESSAGE_LIST_STICKY_THRESHOLD_PX,
} from "../../lib/ui-constants.js";
import { AssistantMessage } from "./messages/AssistantMessage.js";
import { UserMessage } from "./messages/UserMessage.js";
import { selectMessages, useMessagesStore } from "./useMessagesStore.js";
import { useScrollPositionStore } from "./useScrollPositionStore.js";

export function MessageList({ sessionId }: { sessionId: string }) {
  const messages = useMessagesStore(useMemo(() => selectMessages(sessionId), [sessionId]));
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const snapshotScroll = useScrollPositionStore((s) => s.snapshot);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => MESSAGE_LIST_ESTIMATE_PX,
    overscan: 4,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // Restore the saved scroll position (or stick-to-bottom flag) when switching sessions.
  useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const saved = useScrollPositionStore.getState().get(sessionId);
    if (saved?.atBottom !== false) {
      setStickToBottom(true);
      el.scrollTop = el.scrollHeight;
    } else {
      setStickToBottom(false);
      el.scrollTop = saved.offset;
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
    const el = parentRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
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
            const el = parentRef.current;
            if (!el) return;
            el.scrollTop = el.scrollHeight;
            setStickToBottom(true);
          }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-panel-2)] border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          aria-label="Jump to latest message"
        >
          ↓ Jump to latest
        </button>
      )}
    </div>
  );
}
