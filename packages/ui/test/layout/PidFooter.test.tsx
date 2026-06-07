import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { useSessionsStore } from "../../src/features/sessions/useSessionsStore";
import { PidFooter } from "../../src/layout/PidFooter";
import { useNavStore } from "../../src/lib/useNavStore";
import { fireEvent, render, screen, within } from "../utils";

const NAV_STORAGE_KEY = "pi-deck:nav:v1";

function resetStores() {
  useNavStore.setState({
    screen: "blank",
    expandedProjectsOverview: {},
    expandedProjectsRail: {},
  });
  useSessionsStore.setState({
    sessions: [],
    activeSessionId: undefined,
    isRefreshing: false,
    client: undefined,
  });
}

function setAppVersion(version: string | undefined) {
  if (version === undefined) {
    delete (window as { appVersion?: string }).appVersion;
  } else {
    (window as { appVersion?: string }).appVersion = version;
  }
}

describe("PidFooter", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStores();
    setAppVersion(undefined);
  });

  afterEach(() => {
    localStorage.clear();
    resetStores();
    setAppVersion(undefined);
    localStorage.removeItem(NAV_STORAGE_KEY);
  });

  test("renders brand mark and version from window.appVersion", () => {
    setAppVersion("1.2.3");
    render(<PidFooter />);
    expect(screen.getByText("pi-deck")).toBeInTheDocument();
    expect(screen.getByText("1.2.3")).toBeInTheDocument();
  });

  test("falls back to 'dev' when window.appVersion is unset", () => {
    setAppVersion(undefined);
    render(<PidFooter />);
    expect(screen.getByText("dev")).toBeInTheDocument();
  });

  test("does not render the removed project / branch / agent / model segments", () => {
    render(<PidFooter />);
    expect(screen.queryByText("project")).toBeNull();
    expect(screen.queryByText("branch")).toBeNull();
    expect(screen.queryByText("agent")).toBeNull();
    expect(screen.queryByText("model")).toBeNull();
    expect(screen.queryByText(/claude-opus/i)).toBeNull();
  });

  test("renders the screen buttons in order, without SETTINGS or PR", () => {
    render(<PidFooter />);
    const switcher = screen.getByRole("toolbar", { name: "Switch screen" });
    const labels = within(switcher)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(labels).toEqual(["SESSION", "EDITOR", "DIFF", "OVERVIEW", "BLANK"]);
    expect(within(switcher).queryByRole("button", { name: "SETTINGS" })).toBeNull();
    expect(within(switcher).queryByRole("button", { name: "PR" })).toBeNull();
  });

  test("the active screen button reflects nav state", () => {
    useNavStore.setState({ screen: "git-diff" });
    render(<PidFooter />);
    const diff = screen.getByRole("button", { name: "DIFF" });
    expect(diff.getAttribute("data-active")).toBe("true");
    expect(diff.getAttribute("aria-pressed")).toBe("true");

    const blank = screen.getByRole("button", { name: "BLANK" });
    expect(blank.getAttribute("data-active")).toBe("false");
    expect(blank.getAttribute("aria-pressed")).toBe("false");
  });

  test("clicking a wired screen updates the nav store", () => {
    render(<PidFooter />);
    fireEvent.click(screen.getByRole("button", { name: "EDITOR" }));
    expect(useNavStore.getState().screen).toBe("editor");
  });

  test("clicking BLANK routes to the blank screen", () => {
    useNavStore.setState({ screen: "editor" });
    render(<PidFooter />);
    const blank = screen.getByRole("button", { name: "BLANK" });
    expect(blank.getAttribute("aria-disabled")).toBeNull();
    expect(blank.getAttribute("data-disabled")).toBe("false");
    fireEvent.click(blank);
    expect(useNavStore.getState().screen).toBe("blank");
  });

  test("clicking the disabled OVERVIEW button is a no-op", () => {
    useNavStore.setState({ screen: "blank" });
    render(<PidFooter />);
    const overview = screen.getByRole("button", { name: "OVERVIEW" });
    expect(overview.getAttribute("aria-disabled")).toBe("true");
    expect(overview.getAttribute("data-disabled")).toBe("true");
    fireEvent.click(overview);
    expect(useNavStore.getState().screen).toBe("blank");
  });

  test("SESSION button is disabled when there is no active session, enabled once one exists", () => {
    const { rerender } = render(<PidFooter />);
    let sessionBtn = screen.getByRole("button", { name: "SESSION" });
    expect(sessionBtn.getAttribute("data-disabled")).toBe("true");
    fireEvent.click(sessionBtn);
    expect(useNavStore.getState().screen).toBe("blank");

    useSessionsStore.setState({ activeSessionId: "sess-1" });
    rerender(<PidFooter />);
    sessionBtn = screen.getByRole("button", { name: "SESSION" });
    expect(sessionBtn.getAttribute("data-disabled")).toBe("false");
    fireEvent.click(sessionBtn);
    expect(useNavStore.getState().screen).toBe("session");
  });
});
