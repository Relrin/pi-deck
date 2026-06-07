import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen, userEvent } from "../../../test/utils";
import { useNavStore } from "../../lib/useNavStore";
import { useProjectsStore } from "../sessions/useProjectsStore";
import { useSessionsStore } from "../sessions/useSessionsStore";
import { PidIntroScreen } from "./PidIntroScreen";
import { useIntroComposerStore } from "./useIntroComposerStore";
import { useTemplatesStore } from "./useTemplatesStore";

function seedProject() {
  useProjectsStore.setState({
    projects: [
      {
        id: "proj-1",
        path: "/tmp/proj-1",
        displayName: "pi-deck",
        lastOpenedAt: "2026-05-16T12:00:00Z",
      },
    ],
    activeProjectId: "proj-1",
    lastActiveSessionByProject: {},
  });
}

function seedSessions() {
  useSessionsStore.setState((prev) => ({
    ...prev,
    sessions: [
      {
        id: "sess-1",
        projectId: "proj-1",
        title: "Auto-discover MCP servers",
        model: "claude-sonnet-4-6",
        lastActivityAt: "2026-05-16T11:55:00Z",
      },
      {
        id: "sess-2",
        projectId: "proj-1",
        title: "Diff heatmap",
        model: "claude-sonnet-4-6",
        lastActivityAt: "2026-05-16T11:00:00Z",
      },
    ],
  }));
}

// Snapshot the real store actions once so each test can mock freely and still leave the
// store clean for sibling test files (Zustand setState is a partial merge — restoring only
// activateSession would leave my createSession / sendPrompt mocks lying around for the
// next test file that exercises the real `useSessionsStore`).
const originalActivate = useSessionsStore.getState().activateSession;
const originalCreateSession = useSessionsStore.getState().createSession;
const originalSendPrompt = useSessionsStore.getState().sendPrompt;

beforeEach(() => {
  useIntroComposerStore.setState({ text: "" });
  useTemplatesStore.setState({ overrides: {} });
  useNavStore.setState({
    screen: "blank",
    expandedProjectsOverview: {},
    expandedProjectsRail: {},
  });
  seedProject();
  seedSessions();
});

afterEach(() => {
  useSessionsStore.setState((prev) => ({
    ...prev,
    activateSession: originalActivate,
    createSession: originalCreateSession,
    sendPrompt: originalSendPrompt,
  }));
});

describe("PidIntroScreen", () => {
  test("renders hero, templates and recents", () => {
    render(<PidIntroScreen variant="fullscreen" />);
    expect(screen.getByText("what are we shipping today?")).toBeInTheDocument();
    expect(screen.getByText("Fix a failing test")).toBeInTheDocument();
    expect(screen.getByText("Auto-discover MCP servers")).toBeInTheDocument();
  });

  test("fullscreen variant shows ⌘N shortcut hint", () => {
    render(<PidIntroScreen variant="fullscreen" />);
    expect(screen.getByText(/new session/i)).toBeInTheDocument();
  });

  test("inline variant hides ⌘N shortcut hint", () => {
    render(<PidIntroScreen variant="inline-empty-session" />);
    expect(screen.queryByText(/new session/i)).toBeNull();
  });

  test("clicking a template prefills the composer text", () => {
    render(<PidIntroScreen variant="fullscreen" />);
    fireEvent.click(screen.getByText("Fix a failing test"));
    expect(useIntroComposerStore.getState().text).toMatch(/failing test/i);
  });

  test("clicking a template's edit (pencil) button opens the editor seeded from that template", () => {
    render(<PidIntroScreen variant="fullscreen" />);
    fireEvent.click(screen.getByLabelText("Edit template: Fix a failing test"));
    // The dialog's Title field is unique to the editor and seeds from the template default.
    expect(screen.getByLabelText("Title")).toHaveValue("Fix a failing test");
    expect(screen.getByLabelText("Prompt")).toBeInTheDocument();
  });

  test("an overridden template renders the custom title/blurb and prefills its body", () => {
    useTemplatesStore.setState({
      overrides: {
        "fix-failing-test": {
          title: "Tame the flake",
          blurb: "My custom blurb",
          body: "my custom prompt body",
        },
      },
    });
    render(<PidIntroScreen variant="fullscreen" />);
    expect(screen.getByText("Tame the flake")).toBeInTheDocument();
    expect(screen.getByText("My custom blurb")).toBeInTheDocument();
    expect(screen.queryByText("Fix a failing test")).toBeNull();

    fireEvent.click(screen.getByText("Tame the flake"));
    expect(useIntroComposerStore.getState().text).toBe("my custom prompt body");
  });

  test("clicking a recent session activates it and flips screen to session", async () => {
    const activate = mock((id: string) => {
      useSessionsStore.setState((prev) => ({ ...prev, activeSessionId: id }));
      return Promise.resolve();
    });
    useSessionsStore.setState((prev) => ({ ...prev, activateSession: activate }));

    render(<PidIntroScreen variant="fullscreen" />);
    fireEvent.click(screen.getByText("Auto-discover MCP servers"));

    expect(activate).toHaveBeenCalledWith("sess-1");
    expect(useNavStore.getState().screen).toBe("session");
  });

  // Keyboard contract: Enter submits, Shift+Enter inserts a newline. Mirrors MessageInput
  // (SESSION tab) so the composer behaves identically wherever it appears.
  test("plain Enter on the composer submits the prompt", async () => {
    let createdProject: string | undefined;
    let sentText: string | undefined;
    useSessionsStore.setState((prev) => ({
      ...prev,
      createSession: (async (projectId: string) => {
        createdProject = projectId;
      }) as never,
      sendPrompt: (async (text: string) => {
        sentText = text;
      }) as never,
    }));
    useIntroComposerStore.setState({ text: "ship it" });

    const user = userEvent.setup();
    render(<PidIntroScreen variant="fullscreen" />);
    const textarea = screen.getByLabelText("New prompt");
    textarea.focus();
    await user.keyboard("{Enter}");

    expect(createdProject).toBe("proj-1");
    expect(sentText).toBe("ship it");
  });

  test("Shift+Enter on the composer inserts a newline and does NOT submit", async () => {
    let sentText: string | undefined;
    useSessionsStore.setState((prev) => ({
      ...prev,
      sendPrompt: (async (text: string) => {
        sentText = text;
      }) as never,
    }));
    useIntroComposerStore.setState({ text: "line 1" });

    const user = userEvent.setup();
    render(<PidIntroScreen variant="fullscreen" />);
    const textarea = screen.getByLabelText("New prompt") as HTMLTextAreaElement;
    textarea.focus();
    // Move caret to end of the controlled value.
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    await user.type(textarea, "line 2");

    expect(sentText).toBeUndefined();
    expect(useIntroComposerStore.getState().text).toBe("line 1\nline 2");
  });
});
