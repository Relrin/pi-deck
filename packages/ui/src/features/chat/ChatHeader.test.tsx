import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "../../../test/utils";
import { useNavStore } from "../../lib/useNavStore";
import { useSessionsStore } from "../sessions/useSessionsStore";
import { ChatHeader } from "./ChatHeader";

const session = {
  id: "sess-1",
  projectId: "11111111-1111-4111-8111-111111111111",
  title: "Refactor chat header",
  lastActivityAt: "2026-05-20T10:00:00Z",
};

// Snapshot the real action implementations at module load so afterEach can restore them
// after each test mocks them. Without this, the mocked functions leak into later test files
// that share the same zustand store instance and break their assertions.
const originalArchive = useSessionsStore.getState().archiveSession;
const originalUnarchive = useSessionsStore.getState().unarchiveSession;
const originalDelete = useSessionsStore.getState().deleteSession;

beforeEach(() => {
  useNavStore.setState({
    screen: "session",
    expandedProjectsOverview: {},
    expandedProjectsRail: {},
  });
});

afterEach(() => {
  useSessionsStore.setState((prev) => ({
    ...prev,
    archiveSession: originalArchive,
    unarchiveSession: originalUnarchive,
    deleteSession: originalDelete,
  }));
});

describe("ChatHeader", () => {
  test("renders title and archive + delete actions", () => {
    render(<ChatHeader session={session} />);
    expect(screen.getByText("Refactor chat header")).toBeInTheDocument();
    expect(screen.getByLabelText("Archive session")).toBeInTheDocument();
    expect(screen.getByLabelText("Delete session")).toBeInTheDocument();
  });

  test("archive button calls archiveSession", () => {
    const archive = mock(() => Promise.resolve());
    useSessionsStore.setState((prev) => ({ ...prev, archiveSession: archive }));

    render(<ChatHeader session={session} />);
    fireEvent.click(screen.getByLabelText("Archive session"));
    expect(archive).toHaveBeenCalledWith("sess-1");
  });

  test("archived session shows Unarchive label and calls unarchiveSession", () => {
    const unarchive = mock(() => Promise.resolve());
    useSessionsStore.setState((prev) => ({ ...prev, unarchiveSession: unarchive }));

    render(<ChatHeader session={{ ...session, archived: true }} />);
    fireEvent.click(screen.getByLabelText("Unarchive session"));
    expect(unarchive).toHaveBeenCalledWith("sess-1");
  });

  test("delete button opens confirm dialog; confirming deletes and routes to blank", async () => {
    const deleteSession = mock(() => Promise.resolve());
    useSessionsStore.setState((prev) => ({ ...prev, deleteSession }));

    render(<ChatHeader session={session} />);
    fireEvent.click(screen.getByLabelText("Delete session"));

    // Dialog appears with title + a confirm button labelled "Delete".
    expect(await screen.findByText("Delete session?")).toBeInTheDocument();
    const confirm = screen
      .getAllByRole("button", { name: /Delete/ })
      .find((b) => b.textContent === "Delete");
    expect(confirm).toBeDefined();
    confirm && fireEvent.click(confirm);

    // Wait a tick for the async onConfirm to resolve.
    await new Promise((r) => setTimeout(r, 0));

    expect(deleteSession).toHaveBeenCalledWith("sess-1");
    expect(useNavStore.getState().screen).toBe("blank");
  });
});
