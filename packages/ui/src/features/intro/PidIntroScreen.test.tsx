import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "../../../test/utils";
import { useNavStore } from "../../lib/useNavStore";
import { useProjectsStore } from "../sessions/useProjectsStore";
import { useSessionsStore } from "../sessions/useSessionsStore";
import { PidIntroScreen } from "./PidIntroScreen";
import { useIntroComposerStore } from "./useIntroComposerStore";

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

const originalActivate = useSessionsStore.getState().activateSession;

beforeEach(() => {
  useIntroComposerStore.setState({ text: "" });
  useNavStore.setState({
    screen: "overview",
    expandedProjectsOverview: {},
    expandedProjectsRail: {},
  });
  seedProject();
  seedSessions();
});

afterEach(() => {
  useSessionsStore.setState((prev) => ({ ...prev, activateSession: originalActivate }));
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
});
