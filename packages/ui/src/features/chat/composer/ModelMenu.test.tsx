import { beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "../../../../test/utils";
import { ModelMenu } from "./ModelMenu";
import { useComposerStore } from "./useComposerStore";

beforeEach(() => {
  useComposerStore.setState({
    executionMode: "ask",
    model: "claude-sonnet-4-6",
    thinkingEffort: "off",
  });
});

describe("ModelMenu", () => {
  test("trigger shows the current model label", () => {
    render(<ModelMenu />);
    expect(screen.getByRole("button", { name: /Model: Claude Sonnet 4\.6/i })).toBeInTheDocument();
  });

  test("trigger shows '· effort' suffix when a thinking effort is active", () => {
    useComposerStore.setState({ thinkingEffort: "medium" });
    render(<ModelMenu />);
    expect(screen.getByRole("button", { name: /· medium/i })).toBeInTheDocument();
  });

  test("selecting a model updates the store", () => {
    render(<ModelMenu />);
    act(() => {
      fireEvent.pointerDown(screen.getByRole("button", { name: /Model:/i }), {
        button: 0,
        pointerType: "mouse",
      });
    });
    act(() => {
      fireEvent.click(screen.getByText("Claude Opus 4.7"));
    });
    expect(useComposerStore.getState().model).toBe("claude-opus-4-7");
  });

  test("thinking-effort items are disabled when the active model does not support it", () => {
    useComposerStore.setState({ model: "claude-haiku-4-5" });
    render(<ModelMenu />);
    act(() => {
      fireEvent.pointerDown(screen.getByRole("button", { name: /Model:/i }), {
        button: 0,
        pointerType: "mouse",
      });
    });
    const lowItem = screen.getByText("Low");
    expect(lowItem.getAttribute("data-disabled")).not.toBeNull();
  });

  test("thinking-effort items are enabled when the active model supports it", () => {
    render(<ModelMenu />);
    act(() => {
      fireEvent.pointerDown(screen.getByRole("button", { name: /Model:/i }), {
        button: 0,
        pointerType: "mouse",
      });
    });
    const highItem = screen.getByText("High");
    expect(highItem.getAttribute("data-disabled")).toBeNull();
    act(() => {
      fireEvent.click(highItem);
    });
    expect(useComposerStore.getState().thinkingEffort).toBe("high");
  });
});
