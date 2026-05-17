import { describe, expect, test } from "bun:test";
import { render, screen } from "../../test/utils";
import { PidRightPane } from "./PidRightPane";

describe("PidRightPane — tab icons", () => {
  test("Git tab renders the lucide git-branch icon", () => {
    render(<PidRightPane git={<div>git body</div>} context={<div>ctx body</div>} />);
    const gitTab = screen.getByRole("tab", { name: /git/i });
    expect(gitTab.querySelector("svg.lucide.lucide-git-branch")).not.toBeNull();
    expect(gitTab.querySelector('svg:not([class*="lucide"])')).toBeNull();
  });

  test("Context tab renders the lucide layers icon", () => {
    render(<PidRightPane git={<div>git body</div>} context={<div>ctx body</div>} />);
    const contextTab = screen.getByRole("tab", { name: /context/i });
    expect(contextTab.querySelector("svg.lucide.lucide-layers")).not.toBeNull();
    expect(contextTab.querySelector('svg:not([class*="lucide"])')).toBeNull();
  });
});
