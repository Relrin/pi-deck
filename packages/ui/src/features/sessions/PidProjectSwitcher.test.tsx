import { beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "../../../test/utils";
import { useNavStore } from "../../lib/useNavStore";
import { PidProjectSwitcher } from "./PidProjectSwitcher";

const project = {
  id: "p-x",
  path: "/p/x",
  displayName: "Proj X",
  lastOpenedAt: "2026-05-16T12:00:00Z",
};

beforeEach(() => {
  useNavStore.setState({
    screen: "blank",
    expandedProjectsOverview: {},
    expandedProjectsRail: {},
  });
});

describe("PidProjectSwitcher", () => {
  test("toggling persists expand state in the nav store", () => {
    render(<PidProjectSwitcher project={project} count={3} />);
    const header = screen.getByRole("button", { name: /Proj X/ });
    // Default expanded=true (key absent).
    expect(header.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(header);
    expect(useNavStore.getState().expandedProjectsRail["p-x"]).toBe(false);
    fireEvent.click(header);
    expect(useNavStore.getState().expandedProjectsRail["p-x"]).toBe(true);
  });

  test("renders count chip when provided", () => {
    render(<PidProjectSwitcher project={project} count={7} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
