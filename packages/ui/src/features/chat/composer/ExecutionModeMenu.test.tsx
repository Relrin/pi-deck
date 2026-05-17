import { beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "../../../../test/utils";
import { ExecutionModeMenu } from "./ExecutionModeMenu";
import { useComposerStore } from "./useComposerStore";

beforeEach(() => {
  useComposerStore.setState({ executionMode: "ask" });
});

describe("ExecutionModeMenu", () => {
  test("trigger shows the current mode label", () => {
    render(<ExecutionModeMenu />);
    expect(screen.getByRole("button", { name: /Execution mode: Ask/i })).toBeInTheDocument();
  });

  test("selecting a mode updates the store", () => {
    render(<ExecutionModeMenu />);
    const trigger = screen.getByRole("button", { name: /Execution mode/i });
    // Radix Dropdown opens on pointerdown, not click — happy-dom's click does not dispatch
    // a synthetic pointerdown.
    act(() => {
      fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
    });
    act(() => {
      fireEvent.click(screen.getByText("Plan mode"));
    });
    expect(useComposerStore.getState().executionMode).toBe("plan");
  });
});
