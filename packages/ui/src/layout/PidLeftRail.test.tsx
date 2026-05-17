import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "../../test/utils";
import { useSettingsStore } from "../features/settings/useSettingsStore";
import { PidLeftRail } from "./PidLeftRail";

function resetSettings() {
  useSettingsStore.setState({ open: false, section: "appearance" });
}

describe("PidLeftRail — footer cluster", () => {
  beforeEach(() => {
    resetSettings();
  });

  afterEach(() => {
    resetSettings();
  });

  test("renders the settings and terminal buttons in the rail footer", () => {
    render(<PidLeftRail sessions={<div>sessions</div>} files={<div>files</div>} />);
    expect(screen.getByRole("button", { name: "Open settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminal (coming soon)" })).toBeInTheDocument();
  });

  test("clicking the settings button opens the settings modal", () => {
    render(<PidLeftRail sessions={<div>sessions</div>} files={<div>files</div>} />);
    expect(useSettingsStore.getState().open).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(useSettingsStore.getState().open).toBe(true);
  });

  test("terminal button is disabled and clicking it is a no-op", () => {
    render(<PidLeftRail sessions={<div>sessions</div>} files={<div>files</div>} />);
    const terminal = screen.getByRole("button", { name: "Terminal (coming soon)" });
    expect(terminal.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(terminal);
    expect(useSettingsStore.getState().open).toBe(false);
  });
});
