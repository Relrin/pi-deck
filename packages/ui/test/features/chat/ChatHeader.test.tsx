import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { ChatHeader } from "../../../src/features/chat/ChatHeader";
import { useSessionsStore } from "../../../src/features/sessions/useSessionsStore";
import { useNavStore } from "../../../src/lib/useNavStore";
import { fireEvent, render, screen, userEvent } from "../../utils";

const session = {
  id: "sess-1",
  projectId: "11111111-1111-4111-8111-111111111111",
  title: "Refactor chat header",
  lastActivityAt: "2026-05-20T10:00:00Z",
};

// Snapshot the real action so afterEach can put it back — mocks must not leak across
// files in the shared bun:test process (same pattern as PidSessionRow.test.tsx).
const originalRename = useSessionsStore.getState().renameSession;

beforeEach(() => {
  useNavStore.setState({
    screen: "session",
    expandedProjectsRail: {},
  });
});

afterEach(() => {
  useSessionsStore.setState((prev) => ({ ...prev, renameSession: originalRename }));
});

describe("ChatHeader", () => {
  test("renders the session title", () => {
    render(<ChatHeader session={session} />);
    expect(screen.getByText("Refactor chat header")).toBeInTheDocument();
  });

  test("does not render archive / delete actions in the header", () => {
    // These live in the rail's right-click menu now; the chat header is title + meta only.
    render(<ChatHeader session={session} />);
    expect(screen.queryByLabelText("Delete session")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Archive session")).not.toBeInTheDocument();
  });

  test("clicking the title swaps in the rename input", () => {
    render(<ChatHeader session={session} />);
    fireEvent.click(screen.getByText("Refactor chat header"));
    expect(screen.getByLabelText("Session title")).toBeInTheDocument();
  });

  test("typing + blurring the rename input calls renameSession with the trimmed value", async () => {
    const rename = mock(() => Promise.resolve());
    useSessionsStore.setState((prev) => ({ ...prev, renameSession: rename }));

    const user = userEvent.setup();
    render(<ChatHeader session={session} />);
    fireEvent.click(screen.getByText("Refactor chat header"));
    const input = screen.getByLabelText("Session title") as HTMLInputElement;
    // user.clear + user.type goes through real keyboard events so React state updates
    // flush correctly between keystrokes — the bare fireEvent.change route doesn't
    // propagate to the InlineRename closure that `commit` reads.
    await user.clear(input);
    await user.type(input, "  Renamed via header  ");
    fireEvent.blur(input);

    expect(rename).toHaveBeenCalledWith("sess-1", "Renamed via header");
  });
});
