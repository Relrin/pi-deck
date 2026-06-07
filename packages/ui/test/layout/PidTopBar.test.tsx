import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { useSettingsStore } from "../../src/features/settings/useSettingsStore";
import {
  GLOBAL_SCOPE,
  selectCurrentScope,
  useTerminalStore,
} from "../../src/features/terminal/useTerminalStore";
import { PidTopBar } from "../../src/layout/PidTopBar";
import { RAIL_DEFAULTS, useRailState } from "../../src/layout/use-rail-state";
import { fireEvent, render, screen } from "../utils";

function resetStores() {
  useRailState.setState({
    leftWidth: RAIL_DEFAULTS.leftWidth,
    rightWidth: RAIL_DEFAULTS.rightWidth,
    leftVisible: true,
    rightVisible: true,
  });
  useSettingsStore.setState({ open: false, section: "appearance" });
  useTerminalStore.setState({ bySession: {}, currentKey: GLOBAL_SCOPE });
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

  test("renders the three pane-toggle buttons; all three are interactive toggles", () => {
    render(<PidTopBar />);
    const left = screen.getByRole("button", { name: "Hide left rail" });
    const right = screen.getByRole("button", { name: "Hide right pane" });
    // Terminal starts closed, so the bottom toggle reads "Show".
    const bottom = screen.getByRole("button", { name: "Show bottom panel" });

    expect(left).toBeInTheDocument();
    expect(right).toBeInTheDocument();
    expect(bottom).toBeInTheDocument();

    // All three are real toggles — none is a disabled placeholder.
    expect(left.getAttribute("aria-disabled")).toBeNull();
    expect(right.getAttribute("aria-disabled")).toBeNull();
    expect(bottom.getAttribute("aria-disabled")).toBeNull();
    expect(left.getAttribute("aria-pressed")).toBe("true");
    expect(right.getAttribute("aria-pressed")).toBe("true");
    expect(bottom.getAttribute("aria-pressed")).toBe("false");
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

  test("clicking the bottom toggle opens/closes the terminal panel and flips its label", () => {
    render(<PidTopBar />);
    fireEvent.click(screen.getByRole("button", { name: "Show bottom panel" }));
    expect(selectCurrentScope(useTerminalStore.getState()).open).toBe(true);

    // After toggling, the label flips so the next click reads as "Hide".
    const open = screen.getByRole("button", { name: "Hide bottom panel" });
    expect(open.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(open);
    expect(selectCurrentScope(useTerminalStore.getState()).open).toBe(false);
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

  test("topbar layout is decoupled from panel widths so icon spacing stays consistent on resize", () => {
    // The topbar must NOT mirror --rail-w / --rightpane-w (previously it did,
    // which caused the toggle cluster to squeeze when the user dragged the
    // right pane narrower). Asserting via the absence of those data attrs
    // catches the regression at the source: anything that re-introduces a
    // panel-width-driven topbar grid would have to put these back.
    const { container } = render(<PidTopBar />);
    const topbar = container.querySelector(".pid-topbar");
    expect(topbar?.getAttribute("data-leftrail")).toBeNull();
    expect(topbar?.getAttribute("data-rightpane")).toBeNull();

    // Toggling panels must not add the attributes either.
    fireEvent.click(screen.getByRole("button", { name: "Hide left rail" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide right pane" }));
    expect(topbar?.getAttribute("data-leftrail")).toBeNull();
    expect(topbar?.getAttribute("data-rightpane")).toBeNull();
  });

  test("the PI-DECK brand cluster is gone", () => {
    const { container } = render(<PidTopBar />);
    expect(container.querySelector(".pid-topbar-center")).toBeNull();
    expect(container.querySelector(".pid-brand-mark")).toBeNull();
    expect(container.querySelector(".pid-brand-text")).toBeNull();
    expect(screen.queryByText("PI-DECK")).toBeNull();
  });

  test("settings button (when shown) uses the lucide Settings (cog) icon, not Sliders", () => {
    // The button only renders when the left rail is hidden.
    useRailState.setState({ leftVisible: false });
    const { container } = render(<PidTopBar />);
    const settingsBtn = screen.getByRole("button", { name: "Open settings" });
    expect(settingsBtn.querySelector("svg.lucide.lucide-settings")).not.toBeNull();
    expect(container.querySelector("svg.lucide.lucide-sliders")).toBeNull();
  });
});
