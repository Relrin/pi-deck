import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { render, screen } from "../../test/utils";
import { PidBody } from "./PidBody";
import { RAIL_DEFAULTS, useRailState } from "./use-rail-state";

const LEFT_TEXT = "left-rail-content";
const CENTER_TEXT = "center-content";
const RIGHT_TEXT = "right-pane-content";

function resetRailState() {
  useRailState.setState({
    leftWidth: RAIL_DEFAULTS.leftWidth,
    rightWidth: RAIL_DEFAULTS.rightWidth,
    leftVisible: true,
    rightVisible: true,
  });
}

function renderBody() {
  return render(
    <PidBody
      left={<div>{LEFT_TEXT}</div>}
      center={<div>{CENTER_TEXT}</div>}
      right={<div>{RIGHT_TEXT}</div>}
    />,
  );
}

describe("PidBody — visibility wiring", () => {
  beforeEach(() => {
    localStorage.clear();
    resetRailState();
  });

  afterEach(() => {
    localStorage.clear();
    resetRailState();
  });

  test("renders all three sections when both panels are visible", () => {
    const { container } = renderBody();
    expect(screen.getByText(LEFT_TEXT)).toBeInTheDocument();
    expect(screen.getByText(CENTER_TEXT)).toBeInTheDocument();
    expect(screen.getByText(RIGHT_TEXT)).toBeInTheDocument();
    const body = container.querySelector(".pid-body");
    expect(body?.getAttribute("data-leftrail")).toBe("on");
    expect(body?.getAttribute("data-rightpane")).toBe("on");
  });

  test("hides the left rail content when leftVisible is false", () => {
    useRailState.setState({ leftVisible: false });
    const { container } = renderBody();
    expect(screen.queryByText(LEFT_TEXT)).toBeNull();
    expect(screen.getByText(CENTER_TEXT)).toBeInTheDocument();
    expect(screen.getByText(RIGHT_TEXT)).toBeInTheDocument();
    const body = container.querySelector(".pid-body");
    expect(body?.getAttribute("data-leftrail")).toBe("off");
    expect(body?.getAttribute("data-rightpane")).toBe("on");
  });

  test("hides the right pane content when rightVisible is false", () => {
    useRailState.setState({ rightVisible: false });
    const { container } = renderBody();
    expect(screen.getByText(LEFT_TEXT)).toBeInTheDocument();
    expect(screen.getByText(CENTER_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(RIGHT_TEXT)).toBeNull();
    const body = container.querySelector(".pid-body");
    expect(body?.getAttribute("data-leftrail")).toBe("on");
    expect(body?.getAttribute("data-rightpane")).toBe("off");
  });

  test("with both panels hidden, only the center renders and both data attrs are off", () => {
    useRailState.setState({ leftVisible: false, rightVisible: false });
    const { container } = renderBody();
    expect(screen.queryByText(LEFT_TEXT)).toBeNull();
    expect(screen.queryByText(RIGHT_TEXT)).toBeNull();
    expect(screen.getByText(CENTER_TEXT)).toBeInTheDocument();
    const body = container.querySelector(".pid-body");
    expect(body?.getAttribute("data-leftrail")).toBe("off");
    expect(body?.getAttribute("data-rightpane")).toBe("off");
  });

  test("resize handles only render for visible panels", () => {
    useRailState.setState({ leftVisible: false, rightVisible: true });
    const { container } = renderBody();
    expect(container.querySelector(".pid-panel-handle--left")).toBeNull();
    expect(container.querySelector(".pid-panel-handle--right")).not.toBeNull();
  });

  test("an omitted `right` prop still turns the right pane off (structural opt-out)", () => {
    const { container } = render(
      <PidBody left={<div>{LEFT_TEXT}</div>} center={<div>{CENTER_TEXT}</div>} />,
    );
    expect(screen.queryByText(RIGHT_TEXT)).toBeNull();
    const body = container.querySelector(".pid-body");
    expect(body?.getAttribute("data-rightpane")).toBe("off");
  });
});
