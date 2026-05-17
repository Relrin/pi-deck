import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "../../../test/utils";
import { NATIVE_OVERLAY_RESERVE_PX } from "../../lib/platform";
import { PidSettingsView } from "./PidSettingsView";
import { useSettingsStore } from "./useSettingsStore";

const PLATFORM_KEY = "platform";

function resetSettings() {
  useSettingsStore.setState({ open: false, section: "appearance" });
}

function setPlatformOs(os: string | undefined) {
  const w = window as unknown as { [k: string]: unknown };
  if (os === undefined) {
    delete w[PLATFORM_KEY];
  } else {
    w[PLATFORM_KEY] = { os };
  }
}

describe("PidSettingsView — header layout", () => {
  beforeEach(() => {
    resetSettings();
    setPlatformOs(undefined);
  });

  afterEach(() => {
    resetSettings();
    setPlatformOs(undefined);
  });

  test("left cluster holds the back-arrow button (with visible chrome) followed by the 'Settings' label", () => {
    useSettingsStore.setState({ open: true });
    const { container } = render(<PidSettingsView />);

    const header = container.querySelector(".pid-settings-header");
    expect(header).not.toBeNull();

    const actions = header?.querySelector(".pid-settings-header-actions");
    const title = actions?.querySelector(".pid-settings-header-title");
    const closeBtn = actions?.querySelector<HTMLButtonElement>(
      "button[aria-label='Close settings']",
    );

    expect(actions).not.toBeNull();
    expect(title).not.toBeNull();
    expect(closeBtn).not.toBeNull();

    // Order within the left cluster: button first, then the "Settings" label.
    const slots = Array.from(actions?.children ?? []);
    expect(slots[0]).toBe(closeBtn as Element);
    expect(slots[1]).toBe(title as Element);

    // The button uses the dedicated class with visible background/border so it
    // reads as a real control, not a bare inline glyph.
    expect(closeBtn?.classList.contains("pid-settings-back-btn")).toBe(true);

    // Icon is the lucide arrow-left (no more × glyph).
    expect(closeBtn?.querySelector("svg.lucide.lucide-arrow-left")).not.toBeNull();
  });

  test("Esc-to-close hint sits in the right cluster", () => {
    useSettingsStore.setState({ open: true });
    const { container } = render(<PidSettingsView />);

    const header = container.querySelector(".pid-settings-header");
    const hint = header?.querySelector(".pid-settings-header-hint");
    expect(hint).not.toBeNull();
    expect(hint?.textContent?.toLowerCase()).toContain("esc");
    expect(hint?.textContent?.toLowerCase()).toContain("to close");

    // Hint is the *last* child of the header, after the left-cluster actions span.
    const headerChildren = Array.from(header?.children ?? []);
    expect(headerChildren[headerChildren.length - 1]).toBe(hint as Element);

    // No button lives in the hint cluster — the close action moved left.
    expect(hint?.querySelector("button")).toBeNull();
  });

  test("on Windows, the hint cluster reserves space for the native window controls", () => {
    setPlatformOs("win32");
    useSettingsStore.setState({ open: true });
    const { container } = render(<PidSettingsView />);

    const hint = container.querySelector<HTMLElement>(".pid-settings-header-hint");
    expect(hint).not.toBeNull();
    expect(hint?.style.paddingRight).toBe(`${NATIVE_OVERLAY_RESERVE_PX}px`);
  });

  test("on Linux, the hint cluster reserves space for the native window controls", () => {
    setPlatformOs("linux");
    useSettingsStore.setState({ open: true });
    const { container } = render(<PidSettingsView />);

    const hint = container.querySelector<HTMLElement>(".pid-settings-header-hint");
    expect(hint?.style.paddingRight).toBe(`${NATIVE_OVERLAY_RESERVE_PX}px`);
  });

  test("on macOS, no native-overlay padding is applied (traffic lights live elsewhere)", () => {
    setPlatformOs("darwin");
    useSettingsStore.setState({ open: true });
    const { container } = render(<PidSettingsView />);

    const hint = container.querySelector<HTMLElement>(".pid-settings-header-hint");
    expect(hint?.style.paddingRight).toBe("");
  });

  test("clicking the back-arrow button closes the settings overlay", () => {
    useSettingsStore.setState({ open: true });
    render(<PidSettingsView />);
    expect(useSettingsStore.getState().open).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    expect(useSettingsStore.getState().open).toBe(false);
  });

  test("pressing Esc closes the settings overlay (the back button mirrors this affordance)", () => {
    useSettingsStore.setState({ open: true });
    render(<PidSettingsView />);
    expect(useSettingsStore.getState().open).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useSettingsStore.getState().open).toBe(false);
  });
});
