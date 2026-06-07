import { describe, expect, test } from "bun:test";
import { CheckboxItem, TaskListItem } from "../../../../src/features/chat/markdown/CheckboxItem";
import { render } from "../../../utils";

describe("CheckboxItem", () => {
  test("renders the empty square for `- [ ]`", () => {
    const { container } = render(<CheckboxItem checked={false} />);
    const wrap = container.querySelector(".pid-plan-checkbox") as HTMLElement | null;
    expect(wrap).not.toBeNull();
    expect(wrap?.classList.contains("pid-plan-checkbox-checked")).toBe(false);
    expect(wrap?.getAttribute("aria-label")).toBe("Not started");
  });

  test("renders the check icon and the checked class for `- [x]`", () => {
    const { container } = render(<CheckboxItem checked />);
    const wrap = container.querySelector(".pid-plan-checkbox") as HTMLElement | null;
    expect(wrap?.classList.contains("pid-plan-checkbox-checked")).toBe(true);
    expect(wrap?.getAttribute("aria-label")).toBe("Completed");
  });

  test("renders the indeterminate variant", () => {
    const { container } = render(<CheckboxItem checked="indeterminate" />);
    const wrap = container.querySelector(".pid-plan-checkbox") as HTMLElement | null;
    expect(wrap?.classList.contains("pid-plan-checkbox-indeterminate")).toBe(true);
    expect(wrap?.getAttribute("aria-label")).toBe("In progress");
  });
});

describe("TaskListItem", () => {
  test("applies the strikethrough class when a child CheckboxItem is checked", () => {
    const { container } = render(
      <TaskListItem>
        <CheckboxItem checked />
        <span>Step</span>
      </TaskListItem>,
    );
    const li = container.querySelector("li") as HTMLElement | null;
    expect(li?.classList.contains("pid-plan-task-item-checked")).toBe(true);
    expect(li?.getAttribute("data-checked")).toBe("true");
  });

  test("plain (unchecked) task items don't get the strikethrough class", () => {
    const { container } = render(
      <TaskListItem>
        <CheckboxItem checked={false} />
        <span>Step</span>
      </TaskListItem>,
    );
    const li = container.querySelector("li") as HTMLElement | null;
    expect(li?.classList.contains("pid-plan-task-item-checked")).toBe(false);
  });

  test("recognises a checked nested input prop (raw markdown path)", () => {
    // Mirrors react-markdown's structure: an <input type="checkbox" checked /> nested in the
    // li, before the label.
    const { container } = render(
      <TaskListItem>
        <input type="checkbox" checked readOnly />
        Step
      </TaskListItem>,
    );
    const li = container.querySelector("li") as HTMLElement | null;
    expect(li?.classList.contains("pid-plan-task-item-checked")).toBe(true);
  });
});
