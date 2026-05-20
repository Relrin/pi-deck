import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { render, screen, userEvent } from "../../../test/utils";
import { useIntroComposerStore } from "../intro/useIntroComposerStore";
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
  // The SESSION composer reads attachments from the same intro-composer store as the
  // BLANK tab — reset it so a leak from another test can't masquerade as stale state.
  useIntroComposerStore.setState({ attachments: [], text: "" });
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

  test("Stop button advertises the Esc shortcut to assistive tech", () => {
    useMessagesStore.setState({
      bySession: {
        [SID]: { messages: [], toolCalls: {}, isTurnInFlight: true },
      },
    });
    render(<MessageInput sessionId={SID} />);
    const stop = screen.getByRole("button", { name: "Stop generating" });
    expect(stop.getAttribute("aria-keyshortcuts")).toBe("Escape");
  });

  test("Esc cancels the in-flight turn from anywhere on the page", async () => {
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
    // Focus is on document.body — confirming Esc works even when focus isn't on the
    // textarea or the Stop button (the listener is on document).
    await user.keyboard("{Escape}");
    expect(cancelled).toBe(true);
  });

  test("Esc is ignored when no turn is in flight (no spurious cancelPrompt)", async () => {
    let cancelled = false;
    useSessionsStore.setState({
      cancelPrompt: (async () => {
        cancelled = true;
      }) as never,
    });
    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);
    await user.keyboard("{Escape}");
    expect(cancelled).toBe(false);
  });

  test("renders chips for currently-attached files and forwards them on send", async () => {
    useIntroComposerStore.setState({
      attachments: [
        { kind: "file", path: "/repo/src/index.ts" },
        { kind: "folder", path: "/repo/src/lib" },
      ],
    });
    let sentAttachments: unknown;
    useSessionsStore.setState({
      sendPrompt: (async (_text: string, opts: { attachments?: unknown }) => {
        sentAttachments = opts?.attachments;
      }) as never,
    });

    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);

    // Chips should render with the basename for readability and the full path in `title`.
    expect(screen.getByText("index.ts")).toBeInTheDocument();
    expect(screen.getByText("lib")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove /repo/src/index.ts")).toBeInTheDocument();

    const textarea = screen.getByLabelText("Message");
    await user.type(textarea, "use these");
    await user.keyboard("{Enter}");

    expect(sentAttachments).toEqual([
      { kind: "file", path: "/repo/src/index.ts" },
      { kind: "folder", path: "/repo/src/lib" },
    ]);
    // Successful send clears the queued attachments.
    expect(useIntroComposerStore.getState().attachments).toEqual([]);
  });

  test("clicking a chip's × removes that attachment", async () => {
    useIntroComposerStore.setState({
      attachments: [
        { kind: "file", path: "/a.ts" },
        { kind: "file", path: "/b.ts" },
      ],
    });
    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);
    await user.click(screen.getByLabelText("Remove /a.ts"));
    expect(useIntroComposerStore.getState().attachments).toEqual([{ kind: "file", path: "/b.ts" }]);
  });

  test("`@` at a word boundary opens the repo file search dialog", async () => {
    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);
    const textarea = screen.getByLabelText("Message");
    await user.type(textarea, "@");
    // The dialog has a search input with placeholder text we can assert on.
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeNull();
  });

  test("`@` in the middle of a word does NOT open the dialog (typed `@` is preserved)", async () => {
    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);
    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    await user.type(textarea, "user@");
    // No dialog mounted; the `@` should land in the textarea content.
    expect(screen.queryByPlaceholderText(/search/i)).toBeNull();
    expect(textarea.value).toBe("user@");
  });
});
