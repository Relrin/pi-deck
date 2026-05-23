import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  const initialStick = useScrollPositionStore.getState().get(sessionId)?.atBottom !== false;
  const [stickToBottom, setStickToBottomState] = useState<boolean>(initialStick);
  // The layout effect that pins to the bottom needs to read the LIVE value of stickToBottom,
  // not a captured one from the render closure. A user-initiated wheel/touchmove can fire on
  // the same tick as an incoming message delta; without a synchronous source of truth, the
  // layout effect would read the pre-scroll state (`true`) and yank the user back to the
  // bottom. The ref is updated synchronously inside `setStickToBottom`, so reads from the
  // layout effect always see what's currently true.
  const stickToBottomRef = useRef<boolean>(initialStick);
  const setStickToBottom = useCallback((v: boolean) => {
    stickToBottomRef.current = v;
    setStickToBottomState(v);
  }, []);
  // Re-sync `stickToBottom` when `sessionId` changes by updating state during render
  // ("adjusting state when a prop changes"). React discards the in-flight render and
  // re-runs synchronously with the new value, so subsequent effects see it on first commit.
  const prevSessionIdRef = useRef(sessionId);
  if (prevSessionIdRef.current !== sessionId) {
    prevSessionIdRef.current = sessionId;
    const restored = useScrollPositionStore.getState().get(sessionId)?.atBottom !== false;
    stickToBottomRef.current = restored;
    setStickToBottomState(restored);
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
  }, [sessionId, snapshotScroll, setStickToBottom]);

  // Disengage the bottom-pin AS SOON as the user shows intent to scroll up. Wheel events
  // fire synchronously during the user's input — BEFORE the scroll commits and before any
  // streaming delta can re-pin via the layout effect below. Touchmove covers trackpad
  // pinch/two-finger drags. Without this, a delta landing on the same tick as the user's
  // wheel beats the scroll-event-based detection and the user gets yanked back to the
  // bottom mid-scroll. (The companion ref read in the layout effect closes the same race
  // when the cause is purely state-vs-render timing.)
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const disengageOnUp = (deltaY: number) => {
      if (deltaY >= 0) return;
      if (!stickToBottomRef.current) return;
      setStickToBottom(false);
    };
    const onWheel = (e: WheelEvent) => disengageOnUp(e.deltaY);
    let lastTouchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      lastTouchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? null;
      if (y === null || lastTouchY === null) return;
      // Finger moving DOWN on the screen scrolls content DOWN (toward older messages),
      // which from our perspective is "scrolling up" through the history. So deltaY < 0
      // when y > lastTouchY.
      disengageOnUp(lastTouchY - y);
      lastTouchY = y;
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [setStickToBottom]);

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

  // Auto-pin to the bottom when new content arrives — BUT only when the user hasn't shown
  // intent to scroll up. We read `stickToBottomRef` (synchronous) instead of `stickToBottom`
  // (state) because a wheel/touch event handled this same tick may have already disengaged
  // the pin via the ref, while the corresponding state update hasn't propagated to this
  // render yet. Reading the state would yank the user back to the bottom mid-scroll.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on every message change
  useLayoutEffect(() => {
    if (!stickToBottomRef.current) return;
    if (messages.length === 0) return;
    virtualizer.scrollToIndex(messages.length - 1, { align: "end", behavior: "auto" });
  }, [messages]);

  const items = virtualizer.getVirtualItems();

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={parentRef}
        // `right-1` (4px) inset keeps the scrollbar off the chat column's hard right edge.
        // Top/left/bottom stay flush so messages and the streaming status indicator still
        // hug their natural margins.
        className="pid-chat-body absolute inset-y-0 left-0 right-1 overflow-y-auto"
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
