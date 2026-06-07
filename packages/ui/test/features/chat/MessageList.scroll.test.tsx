import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserMessageEntry } from "../../../src/features/chat/types";
import { useMessagesStore } from "../../../src/features/chat/useMessagesStore";
import { useScrollPositionStore } from "../../../src/features/chat/useScrollPositionStore";
import { act, render } from "../../utils";

const SID = "sess-scroll-1";

// Capture every scrollToIndex call made by MessageList. happy-dom has no layout engine
// (scrollHeight / clientHeight are 0 on raw elements), so asserting on container.scrollTop
// would just confirm "0 -> 0". The fix is specifically about WHICH API gets called
// (scrollToIndex vs. raw scrollTop), so capturing that call is the directly-targeted
// assertion — and it survives without any layout fakery.
const scrollToIndexCalls: Array<{ index: number; opts: unknown }> = [];

mock.module("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: i,
        start: i * 120,
        size: 120,
        end: (i + 1) * 120,
        lane: 0,
      })),
    getTotalSize: () => count * 120,
    measureElement: () => {},
    scrollToIndex: (index: number, opts: unknown) => {
      scrollToIndexCalls.push({ index, opts });
    },
  }),
}));

// Import AFTER mock.module so MessageList resolves the mocked virtualizer.
const { MessageList } = await import("../../../src/features/chat/MessageList");

function seedUserMessages(count: number): void {
  const messages: UserMessageEntry[] = Array.from({ length: count }, (_, i) => ({
    kind: "user",
    id: `u-${i}`,
    text: `message ${i}`,
    createdAt: i,
  }));
  useMessagesStore.setState({
    bySession: {
      [SID]: { messages, toolCalls: {}, isTurnInFlight: false },
    },
  });
}

beforeEach(() => {
  scrollToIndexCalls.length = 0;
  useMessagesStore.setState({ bySession: {} });
  useScrollPositionStore.setState({ bySession: {} });
});

afterEach(() => {
  useMessagesStore.setState({ bySession: {} });
  useScrollPositionStore.setState({ bySession: {} });
});

describe("MessageList auto-scroll on open", () => {
  test("fresh open with no saved snapshot pins to the last index", () => {
    seedUserMessages(50);
    render(<MessageList sessionId={SID} />);
    const last = scrollToIndexCalls.at(-1);
    expect(last?.index).toBe(49);
    expect(last?.opts).toMatchObject({ align: "end" });
  });

  test("saved snapshot with atBottom:true pins to the latest (which may have grown)", () => {
    useScrollPositionStore.setState({
      bySession: { [SID]: { offset: 200, atBottom: true } },
    });
    seedUserMessages(80);
    render(<MessageList sessionId={SID} />);
    const last = scrollToIndexCalls.at(-1);
    expect(last?.index).toBe(79);
    expect(last?.opts).toMatchObject({ align: "end" });
  });

  test("saved snapshot with atBottom:false restores the raw offset and does NOT scroll to bottom", () => {
    useScrollPositionStore.setState({
      bySession: { [SID]: { offset: 1234, atBottom: false } },
    });
    seedUserMessages(50);
    render(<MessageList sessionId={SID} />);
    expect(scrollToIndexCalls).toHaveLength(0);
  });

  test("messages arriving after mount (streamed-in race) still pin to bottom", () => {
    render(<MessageList sessionId={SID} />);
    // Empty session at mount: nothing to scroll to.
    expect(scrollToIndexCalls).toHaveLength(0);
    // Messages stream in from the WebSocket after mount. act() flushes the Zustand
    // subscription notification + the layout effects synchronously.
    act(() => {
      seedUserMessages(30);
    });
    // The stick-to-bottom effect re-fires on the new messages reference.
    const last = scrollToIndexCalls.at(-1);
    expect(last?.index).toBe(29);
    expect(last?.opts).toMatchObject({ align: "end" });
  });
});
