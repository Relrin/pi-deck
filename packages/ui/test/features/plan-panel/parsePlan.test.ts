import { describe, expect, test } from "bun:test";
import {
  hasPlanChecklist,
  parsePlanSteps,
  parsePlanTitle,
} from "../../../src/features/plan-panel/parsePlan";

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

  test("do titles not mistake a heading-style step for thee", () => {
    // GLM writes steps as headings (`## [x] ANALYZE`); the real title is the plain heading.
    expect(parsePlanTitle("# Reorganize repo\n## [x] ANALYZE — Complete")).toBe("Reorganize repo");
    expect(parsePlanTitle("## [x] ANALYZE — Complete\n## [~] DESIGN — go")).toBeUndefined();
  });
});

describe("parsePlanSteps — tolerant formats (non-GFM models)", () => {
  test("parses bare checkboxes with no leading bullet", () => {
    const steps = parsePlanSteps("[x] did it\n[~] doing it\n[ ] todo");
    expect(steps.map((s) => s.status)).toEqual(["done", "in-progress", "pending"]);
  });

  test("parses heading-style step lines (e.g. GLM)", () => {
    const steps = parsePlanSteps("## [x] ANALYZE — Complete\n### [~] DESIGN — Creating structure");
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ status: "done", label: "ANALYZE", description: "Complete" });
    expect(steps[1]).toMatchObject({
      status: "in-progress",
      label: "DESIGN",
      description: "Creating structure",
    });
  });

  test("extracts a plain ALL-CAPS label (single and multi-word) before an em-dash", () => {
    const [a, b] = parsePlanSteps("- [ ] DESIGN — lay it out\n- [~] FIX IMPORTS — update paths");
    expect(a).toMatchObject({ label: "DESIGN", description: "lay it out" });
    expect(b).toMatchObject({ label: "FIX IMPORTS", description: "update paths" });
  });

  test("does not treat a sentence-case prefix as a label", () => {
    const [step] = parsePlanSteps("- [ ] Create the main test script");
    expect(step?.label).toBeUndefined();
    expect(step?.description).toBe("Create the main test script");
  });
});

describe("hasPlanChecklist", () => {
  test("true for GFM, bare, and heading checkbox styles", () => {
    expect(hasPlanChecklist("- [ ] step")).toBe(true);
    expect(hasPlanChecklist("[x] step")).toBe(true);
    expect(hasPlanChecklist("## [~] STEP — go")).toBe(true);
  });

  test("false for prose / nullish content", () => {
    expect(hasPlanChecklist("just words")).toBe(false);
    expect(hasPlanChecklist("")).toBe(false);
    expect(hasPlanChecklist(null)).toBe(false);
  });
});
