import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { RAIL_DEFAULTS, useRailState } from "../../src/layout/use-rail-state";

const STORAGE_KEY = "pi-deck:rails:v1";

function resetRailState() {
  useRailState.setState({
    leftWidth: RAIL_DEFAULTS.leftWidth,
    rightWidth: RAIL_DEFAULTS.rightWidth,
    leftVisible: true,
    rightVisible: true,
  });
}

describe("useRailState — visibility", () => {
  beforeEach(() => {
    localStorage.clear();
    resetRailState();
    // Widths are clamped against the live window; give these tests plenty of room so the
    // values they set are never window-capped (that behaviour is covered separately below).
    window.innerWidth = 2000;
  });

  afterEach(() => {
    localStorage.clear();
    resetRailState();
    window.innerWidth = 1024;
  });

  test("both panels are visible by default", () => {
    const { leftVisible, rightVisible } = useRailState.getState();
    expect(leftVisible).toBe(true);
    expect(rightVisible).toBe(true);
  });

  test("toggleLeft flips leftVisible and persists", () => {
    useRailState.getState().toggleLeft();
    expect(useRailState.getState().leftVisible).toBe(false);

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(persisted.state.leftVisible).toBe(false);

    useRailState.getState().toggleLeft();
    expect(useRailState.getState().leftVisible).toBe(true);
  });

  test("toggleRight flips rightVisible and persists", () => {
    useRailState.getState().toggleRight();
    expect(useRailState.getState().rightVisible).toBe(false);

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(persisted.state.rightVisible).toBe(false);

    useRailState.getState().toggleRight();
    expect(useRailState.getState().rightVisible).toBe(true);
  });

  test("hiding then re-showing preserves the last left width", () => {
    useRailState.getState().setLeftWidth(420);
    expect(useRailState.getState().leftWidth).toBe(420);

    useRailState.getState().toggleLeft();
    expect(useRailState.getState().leftVisible).toBe(false);
    // width is preserved while hidden
    expect(useRailState.getState().leftWidth).toBe(420);

    useRailState.getState().toggleLeft();
    expect(useRailState.getState().leftVisible).toBe(true);
    expect(useRailState.getState().leftWidth).toBe(420);
  });

  test("hiding then re-showing preserves the last right width", () => {
    useRailState.getState().setRightWidth(310);
    expect(useRailState.getState().rightWidth).toBe(310);

    useRailState.getState().toggleRight();
    expect(useRailState.getState().rightVisible).toBe(false);
    expect(useRailState.getState().rightWidth).toBe(310);

    useRailState.getState().toggleRight();
    expect(useRailState.getState().rightVisible).toBe(true);
    expect(useRailState.getState().rightWidth).toBe(310);
  });

  test("setLeftVisible / setRightVisible set the flag directly", () => {
    useRailState.getState().setLeftVisible(false);
    useRailState.getState().setRightVisible(false);
    expect(useRailState.getState().leftVisible).toBe(false);
    expect(useRailState.getState().rightVisible).toBe(false);

    useRailState.getState().setLeftVisible(true);
    useRailState.getState().setRightVisible(true);
    expect(useRailState.getState().leftVisible).toBe(true);
    expect(useRailState.getState().rightVisible).toBe(true);
  });
});

describe("useRailState — width clamping", () => {
  beforeEach(() => {
    localStorage.clear();
    resetRailState();
  });

  afterEach(() => {
    localStorage.clear();
    resetRailState();
    window.innerWidth = 1024;
  });

  test("there is no fixed 520px ceiling — panels grow when the window allows", () => {
    window.innerWidth = 2000;
    useRailState.getState().setRightWidth(900);
    // Old behaviour clamped to 520; now only the window caps it.
    expect(useRailState.getState().rightWidth).toBe(900);
  });

  test("a panel can never squeeze the center below MIN_CENTER_WIDTH (360px)", () => {
    window.innerWidth = 1000; // left default 264 visible
    useRailState.getState().setRightWidth(900);
    const { rightWidth, leftWidth } = useRailState.getState();
    // 1000 - 264 - 360 = 376 is the most the right pane may take.
    expect(rightWidth).toBe(376);
    expect(leftWidth + rightWidth + 360).toBeLessThanOrEqual(1000);
  });

  test("a hidden opposite panel frees up its space for the other side", () => {
    window.innerWidth = 1000;
    useRailState.getState().setLeftVisible(false);
    useRailState.getState().setRightWidth(900);
    // With the left rail hidden: 1000 - 0 - 360 = 640.
    expect(useRailState.getState().rightWidth).toBe(640);
  });

  test("clampToWindow re-clamps an over-wide panel after the window shrinks", () => {
    window.innerWidth = 2000;
    // Bypass the setter's clamp to simulate a previously-persisted wide width.
    useRailState.setState({ rightWidth: 900 });
    expect(useRailState.getState().rightWidth).toBe(900);

    window.innerWidth = 1200;
    useRailState.getState().clampToWindow();
    // 1200 - 264 - 360 = 576.
    expect(useRailState.getState().rightWidth).toBe(576);
  });
});
