import { describe, expect, mock, test } from "bun:test";
import { useAttachmentsHotkeys } from "../../../src/features/intro/useAttachmentsHotkeys";
import { renderHook } from "../../utils";

interface KeyOpts {
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  repeat?: boolean;
}

function dispatchO(target: EventTarget | null, opts: KeyOpts = {}) {
  const event = new KeyboardEvent("keydown", {
    key: "o",
    bubbles: true,
    cancelable: true,
    ctrlKey: opts.ctrlKey ?? true,
    metaKey: opts.metaKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    repeat: opts.repeat ?? false,
  });
  (target ?? window).dispatchEvent(event);
  return event;
}

function setup() {
  const onChooseFiles = mock(() => {});
  const onChooseFolder = mock(() => {});
  renderHook(() => useAttachmentsHotkeys({ onChooseFiles, onChooseFolder }));
  return { onChooseFiles, onChooseFolder };
}

describe("useAttachmentsHotkeys", () => {
  test("Ctrl+O calls onChooseFiles", () => {
    const { onChooseFiles, onChooseFolder } = setup();
    dispatchO(window);
    expect(onChooseFiles).toHaveBeenCalledTimes(1);
    expect(onChooseFolder).not.toHaveBeenCalled();
  });

  test("Ctrl+Shift+O calls onChooseFolder", () => {
    const { onChooseFiles, onChooseFolder } = setup();
    dispatchO(window, { shiftKey: true });
    expect(onChooseFolder).toHaveBeenCalledTimes(1);
    expect(onChooseFiles).not.toHaveBeenCalled();
  });

  test("Ctrl+Alt+O is ignored (Alt disqualifies)", () => {
    const { onChooseFiles, onChooseFolder } = setup();
    dispatchO(window, { altKey: true });
    expect(onChooseFiles).not.toHaveBeenCalled();
    expect(onChooseFolder).not.toHaveBeenCalled();
  });

  test("plain 'o' without modifiers is ignored", () => {
    const { onChooseFiles, onChooseFolder } = setup();
    dispatchO(window, { ctrlKey: false });
    expect(onChooseFiles).not.toHaveBeenCalled();
    expect(onChooseFolder).not.toHaveBeenCalled();
  });

  test("event.repeat is ignored (held-down key)", () => {
    const { onChooseFiles } = setup();
    dispatchO(window, { repeat: true });
    expect(onChooseFiles).not.toHaveBeenCalled();
  });

  test("fires when target is a non-editable element (popover regression)", () => {
    const { onChooseFiles } = setup();
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    btn.focus();
    try {
      dispatchO(btn);
      expect(onChooseFiles).toHaveBeenCalledTimes(1);
    } finally {
      document.body.removeChild(btn);
    }
  });

  test("fires when target is a textarea (no editable-target guard)", () => {
    const { onChooseFiles } = setup();
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();
    try {
      dispatchO(textarea);
      expect(onChooseFiles).toHaveBeenCalledTimes(1);
    } finally {
      document.body.removeChild(textarea);
    }
  });

  test("preventDefault is called on a handled chord", () => {
    setup();
    const event = dispatchO(window);
    expect(event.defaultPrevented).toBe(true);
  });

  test("preventDefault is NOT called on an unhandled key", () => {
    setup();
    const event = dispatchO(window, { ctrlKey: false });
    expect(event.defaultPrevented).toBe(false);
  });
});
