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
  });

  afterEach(() => {
    localStorage.clear();
    resetRailState();
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
