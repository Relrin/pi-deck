import { beforeEach, describe, expect, test } from "bun:test";
import { useSlashCommandsStore } from "../../../src/features/chat/composer/useSlashCommandsStore";
import { PidComposerScreen } from "../../../src/features/intro/PidComposerScreen";
import { useIntroComposerStore } from "../../../src/features/intro/useIntroComposerStore";
import { useTemplatesStore } from "../../../src/features/intro/useTemplatesStore";
import { useProjectsStore } from "../../../src/features/sessions/useProjectsStore";
import { useSessionsStore } from "../../../src/features/sessions/useSessionsStore";
import { useNavStore } from "../../../src/lib/useNavStore";
import { fireEvent, render, screen, userEvent } from "../../utils";

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
    expandedProjectsRail: {},
  });
  seedProject();
  useSessionsStore.setState((prev) => ({ ...prev, sessions: [] }));
  useSlashCommandsStore.setState({ bySession: {}, byProject: {} });
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

describe("PidComposerScreen — slash autocomplete", () => {
  test("typing / opens the project-scoped command menu; Enter completes instead of submitting", async () => {
    useSlashCommandsStore.setState({
      byProject: {
        "proj-1": [
          { name: "skill:brave-search", description: "Web search", source: "skill" },
          { name: "review", description: "Review template", source: "prompt" },
        ],
      },
    });
    const user = userEvent.setup();
    render(<PidComposerScreen />);
    const textarea = screen.getByLabelText("New prompt") as HTMLTextAreaElement;

    await user.type(textarea, "/");
    expect(screen.getByRole("listbox", { name: "Slash commands" })).toBeInTheDocument();
    expect(screen.getByText("/skill:brave-search")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    // Completed, not submitted — no session was created and the text holds the command.
    expect(textarea.value).toBe("/skill:brave-search ");
    expect(screen.queryByRole("listbox", { name: "Slash commands" })).toBeNull();
  });

  test("a recognized command token gets the highlight pill", async () => {
    useSlashCommandsStore.setState({
      byProject: {
        "proj-1": [{ name: "skill:brave-search", description: "Web search", source: "skill" }],
      },
    });
    const user = userEvent.setup();
    const { container } = render(<PidComposerScreen />);
    const textarea = screen.getByLabelText("New prompt") as HTMLTextAreaElement;

    await user.type(textarea, "/");
    await user.keyboard("{Enter}");
    await user.type(textarea, "look things up");

    const token = container.querySelector(".pid-composer-command-token");
    expect(token?.textContent).toBe("/skill:brave-search");
  });
});
