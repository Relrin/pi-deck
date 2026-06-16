import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { PidRightPane } from "../../src/layout/PidRightPane";
import { useRightPaneStore } from "../../src/layout/use-right-pane";
import { usePreferencesStore } from "../../src/theme/usePreferencesStore";
import { render, screen } from "../utils";

describe("PidRightPane — tab icons", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ viewMode: "agent" });
    useRightPaneStore.setState({ tab: "git" });
  });

  test("Git tab renders the lucide git-branch icon", () => {
    render(<PidRightPane git={<div>git body</div>} context={<div>ctx body</div>} />);
    const gitTab = screen.getByRole("tab", { name: /git/i });
    expect(gitTab.querySelector("svg.lucide.lucide-git-branch")).not.toBeNull();
    expect(gitTab.querySelector('svg:not([class*="lucide"])')).toBeNull();
  });

  test("Context tab renders the lucide layers icon", () => {
    render(<PidRightPane git={<div>git body</div>} context={<div>ctx body</div>} />);
    const contextTab = screen.getByRole("tab", { name: /context/i });
    expect(contextTab.querySelector("svg.lucide.lucide-layers")).not.toBeNull();
    expect(contextTab.querySelector('svg:not([class*="lucide"])')).toBeNull();
  });
});

describe("PidRightPane — view mode", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ viewMode: "agent" });
    useRightPaneStore.setState({ tab: "git" });
  });

  afterEach(() => {
    usePreferencesStore.setState({ viewMode: "agent" });
    useRightPaneStore.setState({ tab: "git" });
  });

  test("agent mode shows only Git and Context (no Session tab)", () => {
    usePreferencesStore.setState({ viewMode: "agent" });
    render(
      <PidRightPane
        chat={<div>chat body</div>}
        git={<div>git body</div>}
        context={<div>ctx body</div>}
      />,
    );
    expect(screen.queryByRole("tab", { name: /session/i })).toBeNull();
    expect(screen.getByRole("tab", { name: /git/i })).not.toBeNull();
    expect(screen.getByRole("tab", { name: /context/i })).not.toBeNull();
  });

  test("IDE mode shows a Session tab first and renders the chat", () => {
    usePreferencesStore.setState({ viewMode: "ide" });
    useRightPaneStore.setState({ tab: "chat" });
    render(
      <PidRightPane
        chat={<div>chat body</div>}
        git={<div>git body</div>}
        context={<div>ctx body</div>}
      />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]?.textContent).toMatch(/session/i);
    expect(screen.getByText("chat body")).not.toBeNull();
  });

  test("a stale 'chat' tab in agent mode falls back to Git", () => {
    usePreferencesStore.setState({ viewMode: "agent" });
    useRightPaneStore.setState({ tab: "chat" });
    render(
      <PidRightPane
        chat={<div>chat body</div>}
        git={<div>git body</div>}
        context={<div>ctx body</div>}
      />,
    );
    expect(screen.queryByRole("tab", { name: /session/i })).toBeNull();
    expect(screen.getByText("git body")).not.toBeNull();
    // the effect normalises the persisted value back to a valid agent-mode tab
    expect(useRightPaneStore.getState().tab).toBe("git");
  });
});
