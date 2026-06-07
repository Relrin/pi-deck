import { describe, expect, test } from "bun:test";
import { useState } from "react";
import { PidStepper } from "../../../src/components/inputs/PidStepper";
import { render, screen, userEvent } from "../../utils";

function Harness({ initial, onCommit }: { initial: number; onCommit?: (v: number) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <PidStepper
      value={value}
      min={8}
      max={32}
      onChange={(v) => {
        setValue(v);
        onCommit?.(v);
      }}
      ariaLabel="font size"
    />
  );
}

function field(): HTMLInputElement {
  return screen.getByRole("spinbutton", { name: "font size" }) as HTMLInputElement;
}

describe("PidStepper", () => {
  test("the +/- buttons step the value", async () => {
    const user = userEvent.setup();
    render(<Harness initial={13} />);
    await user.click(screen.getByRole("button", { name: "Increase font size" }));
    expect(field().value).toBe("14");
    await user.click(screen.getByRole("button", { name: "Decrease font size" }));
    expect(field().value).toBe("13");
  });

  test("clamps and disables the increase button at max", async () => {
    const user = userEvent.setup();
    render(<Harness initial={32} />);
    expect(screen.getByRole("button", { name: "Increase font size" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Decrease font size" }));
    expect(field().value).toBe("31");
  });

  test("disables the decrease button at min", () => {
    render(<Harness initial={8} />);
    expect(screen.getByRole("button", { name: "Decrease font size" })).toBeDisabled();
  });

  test("typing commits a clamped value on Enter", async () => {
    const user = userEvent.setup();
    render(<Harness initial={13} />);
    const input = field();
    await user.clear(input);
    await user.type(input, "100");
    await user.keyboard("{Enter}");
    expect(field().value).toBe("32");
  });

  test("empty input does not commit a value on Enter", async () => {
    const user = userEvent.setup();
    let committed: number | undefined;
    render(<Harness initial={13} onCommit={(v) => (committed = v)} />);
    const input = field();
    await user.clear(input);
    await user.keyboard("{Enter}");
    expect(committed).toBeUndefined();
  });
});
