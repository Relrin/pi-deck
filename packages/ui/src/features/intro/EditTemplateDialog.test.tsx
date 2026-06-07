import { beforeEach, describe, expect, mock, test } from "bun:test";
import { render, screen, userEvent } from "../../../test/utils";
import { EditTemplateDialog } from "./EditTemplateDialog";
import type { IntroTemplate } from "./templates";
import { useTemplatesStore } from "./useTemplatesStore";

const BASE: IntroTemplate = {
  id: "fix-failing-test",
  num: "01",
  title: "Fix a failing test",
  blurb: "Paste a stack trace, get a patched test + fix.",
  body: "default body",
};

beforeEach(() => {
  useTemplatesStore.setState({ overrides: {} });
});

// userEvent's real keyboard events flush React's controlled-input state correctly under
// happy-dom; `user.clear` alone empties the DOM without firing onChange, so to land an empty
// React state we type a throwaway char and backspace it (each keystroke fires onChange).
async function emptyField(user: ReturnType<typeof userEvent.setup>, el: HTMLElement) {
  await user.clear(el);
  await user.type(el, "x{Backspace}");
}

describe("EditTemplateDialog", () => {
  test("seeds fields from the default when there is no override", () => {
    render(<EditTemplateDialog template={BASE} open onOpenChange={() => {}} />);
    expect(screen.getByLabelText("Title")).toHaveValue("Fix a failing test");
    expect(screen.getByLabelText("Short description")).toHaveValue(BASE.blurb);
    expect(screen.getByLabelText("Prompt")).toHaveValue("default body");
  });

  test("editing fields and clicking Apply writes the override and closes", async () => {
    const onOpenChange = mock(() => {});
    const user = userEvent.setup();
    render(<EditTemplateDialog template={BASE} open onOpenChange={onOpenChange} />);

    const title = screen.getByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Custom title");
    const body = screen.getByLabelText("Prompt");
    await user.clear(body);
    await user.type(body, "custom prompt");

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(useTemplatesStore.getState().overrides[BASE.id]).toEqual({
      title: "Custom title",
      blurb: BASE.blurb,
      body: "custom prompt",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("Apply is disabled when the title is empty", async () => {
    const user = userEvent.setup();
    render(<EditTemplateDialog template={BASE} open onOpenChange={() => {}} />);
    await emptyField(user, screen.getByLabelText("Title"));
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  test("Apply is disabled when the prompt is empty", async () => {
    const user = userEvent.setup();
    render(<EditTemplateDialog template={BASE} open onOpenChange={() => {}} />);
    await emptyField(user, screen.getByLabelText("Prompt"));
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  test("Reset to default is hidden without an override", () => {
    render(<EditTemplateDialog template={BASE} open onOpenChange={() => {}} />);
    expect(screen.queryByText("Reset to default")).toBeNull();
  });

  test("Reset to default clears an existing override and closes", async () => {
    useTemplatesStore.setState({
      overrides: { [BASE.id]: { title: "x", blurb: "y", body: "z" } },
    });
    const onOpenChange = mock(() => {});
    const user = userEvent.setup();
    render(<EditTemplateDialog template={BASE} open onOpenChange={onOpenChange} />);

    await user.click(screen.getByText("Reset to default"));

    expect(useTemplatesStore.getState().overrides[BASE.id]).toBeUndefined();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
