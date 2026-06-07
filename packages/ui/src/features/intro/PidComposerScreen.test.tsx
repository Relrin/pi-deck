import { beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "../../../test/utils";
import { useNavStore } from "../../lib/useNavStore";
import { useProjectsStore } from "../sessions/useProjectsStore";
import { useSessionsStore } from "../sessions/useSessionsStore";
import { PidComposerScreen } from "./PidComposerScreen";
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

beforeEach(() => {
  useIntroComposerStore.setState({ text: "", attachments: [], images: [] });
  useTemplatesStore.setState({ overrides: {} });
  useNavStore.setState({
    screen: "blank",
    expandedProjectsOverview: {},
    expandedProjectsRail: {},
  });
  seedProject();
  useSessionsStore.setState((prev) => ({ ...prev, sessions: [] }));
});

describe("PidComposerScreen — editable templates", () => {
  test("renders the default templates", () => {
    render(<PidComposerScreen />);
    expect(screen.getByText("Fix a failing test")).toBeInTheDocument();
  });

  test("clicking a template's edit (pencil) button opens the editor seeded from that template", () => {
    render(<PidComposerScreen />);
    fireEvent.click(screen.getByLabelText("Edit template: Fix a failing test"));
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
    render(<PidComposerScreen />);
    expect(screen.getByText("Tame the flake")).toBeInTheDocument();
    expect(screen.queryByText("Fix a failing test")).toBeNull();

    fireEvent.click(screen.getByText("Tame the flake"));
    expect(useIntroComposerStore.getState().text).toBe("my custom prompt body");
  });
});
