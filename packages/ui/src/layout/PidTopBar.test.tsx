import { describe, expect, test } from "bun:test";
import { render, screen } from "../../test/utils";
import { PidTopBar } from "./PidTopBar";

describe("PidTopBar", () => {
  test("does not render the settings button (relocated to the left-rail footer)", () => {
    render(<PidTopBar />);
    expect(screen.queryByRole("button", { name: "Open settings" })).toBeNull();
  });

  test("still renders the three pane-toggle placeholder buttons", () => {
    render(<PidTopBar />);
    expect(
      screen.getByRole("button", { name: "Toggle left rail (coming soon)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Toggle bottom panel (coming soon)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Toggle right pane (coming soon)" }),
    ).toBeInTheDocument();
  });
});
