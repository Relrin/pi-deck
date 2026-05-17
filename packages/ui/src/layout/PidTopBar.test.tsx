import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "../../test/utils";
import { useSettingsStore } from "../features/settings/useSettingsStore";
import { PidTopBar } from "./PidTopBar";
import { RAIL_DEFAULTS, useRailState } from "./use-rail-state";

function resetStores() {
  useRailState.setState({
    leftWidth: RAIL_DEFAULTS.leftWidth,
    rightWidth: RAIL_DEFAULTS.rightWidth,
    leftVisible: true,
    rightVisible: true,
  });
  useSettingsStore.setState({ open: false, section: "appearance" });
}

describe("PidTopBar — panel toggles", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStores();
  });

  afterEach(() => {
    localStorage.clear();
    resetStores();
  });

  test("renders the three pane-toggle buttons; left/right are interactive, bottom is the placeholder", () => {
    render(<PidTopBar />);
    const left = screen.getByRole("button", { name: "Hide left rail" });
    const right = screen.getByRole("button", { name: "Hide right pane" });
    const bottom = screen.getByRole("button", {
      name: "Toggle bottom panel (coming soon)",
    });

    expect(left).toBeInTheDocument();
    expect(right).toBeInTheDocument();
    expect(bottom).toBeInTheDocument();

    // Left/right are real toggles, not placeholders.
    expect(left.getAttribute("aria-disabled")).toBeNull();
    expect(right.getAttribute("aria-disabled")).toBeNull();
    expect(left.getAttribute("aria-pressed")).toBe("true");
    expect(right.getAttribute("aria-pressed")).toBe("true");

    // Bottom remains a disabled placeholder until the terminal exists.
    expect(bottom.getAttribute("aria-disabled")).toBe("true");
  });

  test("clicking the left toggle hides the left rail and updates the label", () => {
    render(<PidTopBar />);
    fireEvent.click(screen.getByRole("button", { name: "Hide left rail" }));
    expect(useRailState.getState().leftVisible).toBe(false);

    // After toggling, the label flips so the next click reads as "Show".
    const left = screen.getByRole("button", { name: "Show left rail" });
    expect(left.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(left);
    expect(useRailState.getState().leftVisible).toBe(true);
  });

  test("clicking the right toggle hides the right pane and updates the label", () => {
    render(<PidTopBar />);
    fireEvent.click(screen.getByRole("button", { name: "Hide right pane" }));
    expect(useRailState.getState().rightVisible).toBe(false);

    const right = screen.getByRole("button", { name: "Show right pane" });
    expect(right.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(right);
    expect(useRailState.getState().rightVisible).toBe(true);
  });

  test("clicking the bottom placeholder is a no-op", () => {
    render(<PidTopBar />);
    const bottom = screen.getByRole("button", {
      name: "Toggle bottom panel (coming soon)",
    });
    fireEvent.click(bottom);
    expect(useRailState.getState().leftVisible).toBe(true);
    expect(useRailState.getState().rightVisible).toBe(true);
  });

  test("settings button appears in the topbar only when the left rail is hidden", () => {
    render(<PidTopBar />);
    // While the rail is visible, settings lives in the rail footer — not the topbar.
    expect(screen.queryByRole("button", { name: "Open settings" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Hide left rail" }));
    const settings = screen.getByRole("button", { name: "Open settings" });
    expect(settings).toBeInTheDocument();

    fireEvent.click(settings);
    expect(useSettingsStore.getState().open).toBe(true);

    // Reset and re-show the rail; the topbar settings affordance should disappear again.
    useSettingsStore.setState({ open: false, section: "appearance" });
    fireEvent.click(screen.getByRole("button", { name: "Show left rail" }));
    expect(screen.queryByRole("button", { name: "Open settings" })).toBeNull();
  });

  test("topbar sets data attributes that mirror panel visibility for the CSS grid", () => {
    const { container } = render(<PidTopBar />);
    const topbar = container.querySelector(".pid-topbar");
    expect(topbar?.getAttribute("data-leftrail")).toBe("on");
    expect(topbar?.getAttribute("data-rightpane")).toBe("on");

    fireEvent.click(screen.getByRole("button", { name: "Hide left rail" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide right pane" }));
    expect(topbar?.getAttribute("data-leftrail")).toBe("off");
    expect(topbar?.getAttribute("data-rightpane")).toBe("off");
  });
});
