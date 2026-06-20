import { describe, expect, test } from "bun:test";
import { composePlanPrompt } from "../../../src/extensions/agent-mode/plan-prompt.js";

const PLAN_FILE = "/repo/.pi-deck/plans/abc-123.md";

describe("composePlanPrompt", () => {
  test("appends the Plan Mode section to the original prompt", () => {
    const out = composePlanPrompt("ORIGINAL SYSTEM PROMPT", { planFilePath: PLAN_FILE });
    expect(out.startsWith("ORIGINAL SYSTEM PROMPT")).toBe(true);
    expect(out).toContain("# Plan Mode");
  });

  test("tells the agent it is in plan mode and points at the plan file", () => {
    const out = composePlanPrompt("x", { planFilePath: PLAN_FILE });
    expect(out.toLowerCase()).toContain("plan mode");
    expect(out).toContain("read-only");
    expect(out).toContain(PLAN_FILE);
  });

  test("includes the structured plan section headings", () => {
    const out = composePlanPrompt("x", { planFilePath: PLAN_FILE });
    for (const heading of ["Context", "Plan", "Files to touch", "Verification"]) {
      expect(out).toContain(heading);
    }
  });
});
