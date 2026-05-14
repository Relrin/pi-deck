import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { render, screen, userEvent } from "../../../test/utils";
import { useSessionsStore } from "../sessions/useSessionsStore";
import { MessageInput } from "./MessageInput";
import { useMessagesStore } from "./useMessagesStore";

const SID = "sess-1";

// Snapshot the original actions so MessageInput's mocks don't leak into other test files
// (Zustand stores live in module scope; setState is a partial merge with no auto-reset).
const ORIGINAL_SEND = useSessionsStore.getState().sendPrompt;
const ORIGINAL_CANCEL = useSessionsStore.getState().cancelPrompt;

beforeEach(() => {
  useMessagesStore.setState({ bySession: {} });
  useSessionsStore.setState({
    sessions: [],
    activeSessionId: SID,
    isRefreshing: false,
    client: undefined,
    sendPrompt: ORIGINAL_SEND,
    cancelPrompt: ORIGINAL_CANCEL,
  });
});

// Restore once at the very end so we don't leak mocks into sibling test files. Restoring
// in afterEach would fire a Zustand notification on the still-mounted MessageInput and
// trip React 19's "update not wrapped in act" warning after the test has finished.
afterAll(() => {
  useSessionsStore.setState({
    sendPrompt: ORIGINAL_SEND,
    cancelPrompt: ORIGINAL_CANCEL,
  });
});

describe("MessageInput", () => {
  test("Send button is disabled when the input is empty or whitespace", async () => {
    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);
    const send = screen.getByRole("button", { name: "Send message" });
    expect(send).toBeDisabled();

    const textarea = screen.getByLabelText("Message");
    await user.type(textarea, "   ");
    expect(send).toBeDisabled();

    await user.type(textarea, "hello");
    expect(send).not.toBeDisabled();
  });

  test("plain Enter submits the input", async () => {
    let sent: string | undefined;
    useSessionsStore.setState({
      sendPrompt: (async (text: string) => {
        sent = text;
      }) as never,
    });
    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);
    const textarea = screen.getByLabelText("Message");
    await user.type(textarea, "ship it");
    await user.keyboard("{Enter}");
    expect(sent).toBe("ship it");
  });

  test("Shift+Enter inserts a newline and does NOT submit", async () => {
    let sent: string | undefined;
    useSessionsStore.setState({
      sendPrompt: (async (text: string) => {
        sent = text;
      }) as never,
    });
    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);
    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    await user.type(textarea, "line 1");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    await user.type(textarea, "line 2");
    expect(sent).toBeUndefined();
    expect(textarea.value).toBe("line 1\nline 2");
  });

  test("Ctrl+Enter inserts a newline and does NOT submit", async () => {
    let sent: string | undefined;
    useSessionsStore.setState({
      sendPrompt: (async (text: string) => {
        sent = text;
      }) as never,
    });
    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);
    const textarea = screen.getByLabelText("Message");
    await user.type(textarea, "wait");
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(sent).toBeUndefined();
  });

  test("Cmd+Enter inserts a newline and does NOT submit (macOS)", async () => {
    let sent: string | undefined;
    useSessionsStore.setState({
      sendPrompt: (async (text: string) => {
        sent = text;
      }) as never,
    });
    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);
    const textarea = screen.getByLabelText("Message");
    await user.type(textarea, "wait");
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    expect(sent).toBeUndefined();
  });

  test("during in-flight, Stop button appears and fires cancelPrompt", async () => {
    useMessagesStore.setState({
      bySession: {
        [SID]: { messages: [], toolCalls: {}, isTurnInFlight: true },
      },
    });
    let cancelled = false;
    useSessionsStore.setState({
      cancelPrompt: (async () => {
        cancelled = true;
      }) as never,
    });
    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);
    const stop = screen.getByRole("button", { name: "Stop generating" });
    expect(stop).toBeInTheDocument();
    await user.click(stop);
    expect(cancelled).toBe(true);
  });
});
