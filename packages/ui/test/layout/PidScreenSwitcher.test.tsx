import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { PidScreenSwitcher } from "../../src/layout/PidScreenSwitcher";
import { usePreferencesStore } from "../../src/theme/usePreferencesStore";
import { render, screen } from "../utils";

describe("PidScreenSwitcher — view mode", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ viewMode: "agent" });
  });

  afterEach(() => {
    usePreferencesStore.setState({ viewMode: "agent" });
  });

  test("agent mode shows SESSION, EDITOR, DIFF and BLANK", () => {
    usePreferencesStore.setState({ viewMode: "agent" });
    render(<PidScreenSwitcher />);
    expect(screen.getByRole("button", { name: "SESSION" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "EDITOR" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "DIFF" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "BLANK" })).not.toBeNull();
  });

  test("IDE mode drops the redundant SESSION button", () => {
    usePreferencesStore.setState({ viewMode: "ide" });
    render(<PidScreenSwitcher />);
    expect(screen.queryByRole("button", { name: "SESSION" })).toBeNull();
    expect(screen.getByRole("button", { name: "EDITOR" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "DIFF" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "BLANK" })).not.toBeNull();
  });
});
