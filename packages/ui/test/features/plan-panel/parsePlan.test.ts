import { describe, expect, test } from "bun:test";
import { parsePlanSteps, parsePlanTitle } from "../../../src/features/plan-panel/parsePlan";

describe("parsePlanSteps", () => {
  test("returns [] for empty / null / non-plan content", () => {
    expect(parsePlanSteps("")).toEqual([]);
    expect(parsePlanSteps(null)).toEqual([]);
    expect(parsePlanSteps(undefined)).toEqual([]);
    expect(parsePlanSteps("# Heading\n\nsome prose, no checkboxes")).toEqual([]);
  });

  test("maps each marker to a status", () => {
    const steps = parsePlanSteps("- [ ] pending\n- [~] working\n- [x] finished\n- [X] also done");
    expect(steps.map((s) => s.status)).toEqual(["pending", "in-progress", "done", "done"]);
  });

  test("extracts a **LABEL** — operation tag and strips it from the description", () => {
    const [step] = parsePlanSteps("- [ ] **WRITE** — add discover() + watcher");
    expect(step?.label).toBe("WRITE");
    expect(step?.description).toBe("add discover() + watcher");
  });

  test("falls back to no label when there is no prefix", () => {
    const [step] = parsePlanSteps("- [ ] just a plain step");
    expect(step?.label).toBeUndefined();
    expect(step?.description).toBe("just a plain step");
  });

  test("strips inline markdown emphasis from the description", () => {
    const [step] = parsePlanSteps("- [ ] call `discover()` in **boot**");
    expect(step?.description).toBe("call discover() in boot");
  });

  test("ignores non-checkbox bullets (e.g. Files-to-touch paths)", () => {
    const steps = parsePlanSteps("## Plan\n- [ ] do it\n## Files\n- src/foo.ts — note");
    expect(steps).toHaveLength(1);
    expect(steps[0]?.description).toBe("do it");
  });

  test("ids are stable across re-parses and disambiguate duplicate descriptions", () => {
    const a = parsePlanSteps("- [ ] same\n- [ ] same");
    const b = parsePlanSteps("- [x] same\n- [ ] same");
    // Same wording → same base id regardless of marker (so the store matches a step to its
    // prior status across rewrites); the occurrence suffix keeps the two duplicate lines distinct.
    expect(a[0]?.id).toBe(b[0]?.id);
    expect(a[1]?.id).toBe(b[1]?.id);
    expect(a[0]?.id).not.toBe(a[1]?.id);
  });

  test("indexes reflect document order", () => {
    const steps = parsePlanSteps("- [ ] one\n- [ ] two\n- [ ] three");
    expect(steps.map((s) => s.index)).toEqual([0, 1, 2]);
  });
});

describe("parsePlanTitle", () => {
  test("returns the first ATX heading", () => {
    expect(parsePlanTitle("# Auto-discover MCP servers\n\n**Context** — why")).toBe(
      "Auto-discover MCP servers",
    );
    expect(parsePlanTitle("## Build it\n- [ ] step")).toBe("Build it");
  });

  test("strips emphasis from the heading", () => {
    expect(parsePlanTitle("# Ship **the** thing")).toBe("Ship the thing");
  });

  test("returns undefined when there is no heading", () => {
    expect(parsePlanTitle("**Context** — why\n- [ ] step")).toBeUndefined();
    expect(parsePlanTitle("")).toBeUndefined();
    expect(parsePlanTitle(null)).toBeUndefined();
  });
});
