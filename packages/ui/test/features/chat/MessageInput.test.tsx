import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { useSlashCommandsStore } from "../../../src/features/chat/composer/useSlashCommandsStore";
import { MessageInput } from "../../../src/features/chat/MessageInput";
import { useMessagesStore } from "../../../src/features/chat/useMessagesStore";
import { useIntroComposerStore } from "../../../src/features/intro/useIntroComposerStore";
import { useSessionsStore } from "../../../src/features/sessions/useSessionsStore";
import { render, screen, userEvent } from "../../utils";

const SID = "sess-1";

// Snapshot the original actions so MessageInput's mocks don't leak into other test files
// (Zustand stores live in module scope; setState is a partial merge with no auto-reset).
const ORIGINAL_SEND = useSessionsStore.getState().sendPrompt;
const ORIGINAL_CANCEL = useSessionsStore.getState().cancelPrompt;
const ORIGINAL_FORCE_STOP = useSessionsStore.getState().forceStopPrompt;

beforeEach(() => {
  useMessagesStore.setState({ bySession: {} });
  useSessionsStore.setState({
    sessions: [],
    activeSessionId: SID,
    isRefreshing: false,
    client: undefined,
    sendPrompt: ORIGINAL_SEND,
    cancelPrompt: ORIGINAL_CANCEL,
    forceStopPrompt: ORIGINAL_FORCE_STOP,
  });
  // The SESSION composer reads attachments from the same intro-composer store as the
  // BLANK tab — reset it so a leak from another test can't masquerade as stale state.
  useIntroComposerStore.setState({ attachments: [], images: [], text: "" });
  useSlashCommandsStore.setState({ bySession: {} });
});

// Restore once at the very end so we don't leak mocks into sibling test files. Restoring
// in afterEach would fire a Zustand notification on the still-mounted MessageInput and
// trip React 19's "update not wrapped in act" warning after the test has finished.
afterAll(() => {
  useSessionsStore.setState({
    sendPrompt: ORIGINAL_SEND,
    cancelPrompt: ORIGINAL_CANCEL,
    forceStopPrompt: ORIGINAL_FORCE_STOP,
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

  test("typing / opens the command menu; Enter inserts the selected command", async () => {
    useSlashCommandsStore.setState({
      bySession: {
        [SID]: [
          { name: "skill:brave-search", description: "Web search", source: "skill" },
          { name: "commit", description: "Commit changes", source: "prompt" },
        ],
      },
    });
    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);
    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;

    await user.type(textarea, "/");
    expect(screen.getByRole("listbox", { name: "Slash commands" })).toBeInTheDocument();
    expect(screen.getByText("/skill:brave-search")).toBeInTheDocument();
    expect(screen.getByText("/commit")).toBeInTheDocument();

    // First item is active; Enter completes it instead of submitting.
    await user.keyboard("{Enter}");
    expect(textarea.value).toBe("/skill:brave-search ");
    expect(screen.queryByRole("listbox", { name: "Slash commands" })).toBeNull();
  });

  test("the / menu filters by the typed token and arrows move the selection", async () => {
    useSlashCommandsStore.setState({
      bySession: {
        [SID]: [
          { name: "skill:brave-search", description: "Web search", source: "skill" },
          { name: "commit", description: "Commit changes", source: "prompt" },
          { name: "compact", description: "Compact context", source: "extension" },
        ],
      },
    });
    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);
    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;

    await user.type(textarea, "/com");
    expect(screen.queryByText("/skill:brave-search")).toBeNull();
    expect(screen.getByText("/commit")).toBeInTheDocument();
    expect(screen.getByText("/compact")).toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}");
    expect(textarea.value).toBe("/compact ");
  });

  test("Esc dismisses the / menu without clearing the input", async () => {
    useSlashCommandsStore.setState({
      bySession: { [SID]: [{ name: "commit", source: "prompt" }] },
    });
    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);
    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;

    await user.type(textarea, "/co");
    expect(screen.getByRole("listbox", { name: "Slash commands" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox", { name: "Slash commands" })).toBeNull();
    expect(textarea.value).toBe("/co");
  });

  test("a recognized command token gets the highlight pill", async () => {
    useSlashCommandsStore.setState({
      bySession: {
        [SID]: [{ name: "skill:brave-search", description: "Web search", source: "skill" }],
      },
    });
    const user = userEvent.setup();
    const { container } = render(<MessageInput sessionId={SID} />);
    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;

    await user.type(textarea, "/");
    await user.keyboard("{Enter}"); // completes to "/skill:brave-search "
    await user.type(textarea, "find the pi docs");

    expect(textarea.value).toBe("/skill:brave-search find the pi docs");
    const token = container.querySelector(".pid-composer-command-token");
    expect(token?.textContent).toBe("/skill:brave-search");
  });

  test("an unknown leading token gets no highlight pill", async () => {
    useSlashCommandsStore.setState({
      bySession: { [SID]: [{ name: "commit", source: "prompt" }] },
    });
    const user = userEvent.setup();
    const { container } = render(<MessageInput sessionId={SID} />);
    await user.type(screen.getByLabelText("Message"), "/nope do things");
    expect(container.querySelector(".pid-composer-command-token")).toBeNull();
  });

  test("a / mid-message does not open the command menu", async () => {
    useSlashCommandsStore.setState({
      bySession: { [SID]: [{ name: "commit", source: "prompt" }] },
    });
    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);
    await user.type(screen.getByLabelText("Message"), "look at src/");
    expect(screen.queryByRole("listbox", { name: "Slash commands" })).toBeNull();
  });

  test("after Stop, the button escalates to Force stop and fires forceStopPrompt", async () => {
    useMessagesStore.setState({
      bySession: {
        [SID]: { messages: [], toolCalls: {}, isTurnInFlight: true },
      },
    });
    let forced = false;
    useSessionsStore.setState({
      cancelPrompt: (async () => {
        // Simulate the wedged-agent case: cancel never ends the turn.
      }) as never,
      forceStopPrompt: (async () => {
        forced = true;
      }) as never,
    });
    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);

    await user.click(screen.getByRole("button", { name: "Stop generating" }));
    const force = screen.getByRole("button", { name: "Force stop" });
    expect(force).toBeInTheDocument();
    await user.click(force);
    expect(forced).toBe(true);
  });

  test("escalation resets to plain Stop once the turn ends", async () => {
    useMessagesStore.setState({
      bySession: {
        [SID]: { messages: [], toolCalls: {}, isTurnInFlight: true },
      },
    });
    useSessionsStore.setState({ cancelPrompt: (async () => {}) as never });
    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);

    await user.click(screen.getByRole("button", { name: "Stop generating" }));
    expect(screen.getByRole("button", { name: "Force stop" })).toBeInTheDocument();

    // Turn ends (e.g. worker exit after a force-kill) — composer returns to Send, and the
    // next in-flight turn starts back at the graceful Stop button.
    useMessagesStore.setState({
      bySession: { [SID]: { messages: [], toolCalls: {}, isTurnInFlight: false } },
    });
    expect(await screen.findByRole("button", { name: "Send message" })).toBeInTheDocument();

    useMessagesStore.setState({
      bySession: { [SID]: { messages: [], toolCalls: {}, isTurnInFlight: true } },
    });
    expect(await screen.findByRole("button", { name: "Stop generating" })).toBeInTheDocument();
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

  test("renders image thumbnail chip and forwards image payload on send", async () => {
    useIntroComposerStore.setState({
      images: [
        {
          id: "img-1",
          mimeType: "image/png",
          data: "AAAAAAA=",
          thumbnailDataUrl: "data:image/webp;base64,UVQ=",
          name: "screenshot.png",
          byteSize: 7,
        },
      ],
    });
    let sentImages: unknown;
    let sentMessageImages: unknown;
    useSessionsStore.setState({
      sendPrompt: (async (_text: string, opts: { images?: unknown; messageImages?: unknown }) => {
        sentImages = opts?.images;
        sentMessageImages = opts?.messageImages;
      }) as never,
    });

    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);

    expect(screen.getByLabelText("Preview screenshot.png")).toBeInTheDocument();

    const textarea = screen.getByLabelText("Message");
    await user.type(textarea, "what is this");
    await user.keyboard("{Enter}");

    expect(sentImages).toEqual([
      { mimeType: "image/png", data: "AAAAAAA=", name: "screenshot.png" },
    ]);
    expect(sentMessageImages).toEqual([
      {
        thumbnailDataUrl: "data:image/webp;base64,UVQ=",
        name: "screenshot.png",
        mimeType: "image/png",
      },
    ]);
    expect(useIntroComposerStore.getState().images).toEqual([]);
  });

  test("clicking an image chip's × removes that image without opening the lightbox", async () => {
    useIntroComposerStore.setState({
      images: [
        {
          id: "img-1",
          mimeType: "image/png",
          data: "AA==",
          thumbnailDataUrl: "data:image/webp;base64,UA==",
          name: "a.png",
          byteSize: 1,
        },
        {
          id: "img-2",
          mimeType: "image/png",
          data: "BB==",
          thumbnailDataUrl: "data:image/webp;base64,UB==",
          name: "b.png",
          byteSize: 1,
        },
      ],
    });
    const user = userEvent.setup();
    render(<MessageInput sessionId={SID} />);
    await user.click(screen.getByLabelText("Remove a.png"));
    expect(useIntroComposerStore.getState().images.map((i) => i.id)).toEqual(["img-2"]);
  });
});
