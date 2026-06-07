import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { useSessionsStore } from "../../../../src/features/sessions/useSessionsStore";
import { TerminalSection } from "../../../../src/features/settings/sections/TerminalSection";
import { useTerminalSettingsStore } from "../../../../src/features/terminal/useTerminalSettingsStore";
import { render, screen, userEvent } from "../../../utils";

describe("TerminalSection — font selector & size stepper", () => {
  beforeEach(() => {
    useSessionsStore.setState({ client: undefined });
    useTerminalSettingsStore.setState({
      shellPath: null,
      fontFamily: "",
      fontSize: 13,
      defaultCwd: "session",
    });
  });

  afterEach(() => {
    useSessionsStore.setState({ client: undefined });
  });

  test("choosing Custom… reveals a free-text field that writes the family to the store", async () => {
    const user = userEvent.setup();
    render(<TerminalSection />);
    expect(screen.queryByLabelText("Custom font family")).toBeNull();

    await user.selectOptions(screen.getByLabelText("Font family"), "__custom__");
    await user.type(screen.getByLabelText("Custom font family"), "Comic Mono");

    expect(useTerminalSettingsStore.getState().fontFamily).toBe("Comic Mono");
  });

  test("a stored custom family opens in the custom field", () => {
    useTerminalSettingsStore.setState({ fontFamily: "Some Uninstalled Font" });
    render(<TerminalSection />);
    const custom = screen.getByLabelText("Custom font family") as HTMLInputElement;
    expect(custom.value).toBe("Some Uninstalled Font");
  });

  test("the font-size stepper writes to the store", async () => {
    const user = userEvent.setup();
    render(<TerminalSection />);
    await user.click(screen.getByRole("button", { name: "Increase font size" }));
    expect(useTerminalSettingsStore.getState().fontSize).toBe(14);
  });
});
