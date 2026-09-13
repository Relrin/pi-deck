import { describe, expect, test } from "bun:test";
import { PidKbd } from "../../src/components/kbd/PidKbd";
import { rich, slot } from "../../src/i18n/rich";
import { render } from "../utils";

/**
 * `rich()` is the one mechanism phases 05/06 introduce rather than reuse, and the thing it must
 * not do is change what a hint reads. Every case below pins the rendered text against the string
 * the component produced before its sentence moved into the catalog.
 */
describe("rich", () => {
  test("a two-slot hint renders the pre-conversion text byte for byte", () => {
    // AskCard's composer hint, which before extraction was:
    //   <PidKbd keys={["Enter"]} /> send · <PidKbd keys={["Shift", "Enter"]} /> new line
    const { container } = render(
      <span>
        {rich(`${slot("enter")} send · ${slot("shiftEnter")} new line`, {
          enter: <PidKbd keys={["Enter"]} />,
          shiftEnter: <PidKbd keys={["Shift", "Enter"]} />,
        })}
      </span>,
    );
    expect(container.textContent).toBe("↵ send · Shift↵ new line");
  });

  test("keeps the separator's own spacing, which an interpolated argument would have lost", () => {
    // typesafe-i18n trims argument values, so the " · " has to come from the template. This is
    // the property that makes the whitespace-free sentinel worth having.
    const { container } = render(
      <span>{rich(`${slot("a")} · ${slot("b")}`, { a: <i>A</i>, b: <i>B</i> })}</span>,
    );
    expect(container.textContent).toBe("A · B");
  });

  test("passes a slot-free string straight through", () => {
    const { container } = render(<span>{rich("Approve & execute", {})}</span>);
    expect(container.textContent).toBe("Approve & execute");
  });

  test("renders the node, not the slot name", () => {
    const { container } = render(
      <span>{rich(`${slot("esc")} to close`, { esc: <PidKbd keys={["Esc"]} /> })}</span>,
    );
    expect(container.textContent).toBe("Esc to close");
    expect(container.textContent).not.toContain("esc\u0000");
    expect(container.querySelector("kbd")?.textContent).toBe("Esc");
  });
});
