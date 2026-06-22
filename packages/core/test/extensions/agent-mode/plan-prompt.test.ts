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

  test("documents the LABEL operation tag and the [~]/[x] execution markers", () => {
    const out = composePlanPrompt("x", { planFilePath: PLAN_FILE });
    expect(out).toContain("**LABEL**");
    expect(out).toContain("[~]");
    expect(out).toContain("[x]");
  });

  test("asks for an H1 title and an embedded progress note", () => {
    const out = composePlanPrompt("x", { planFilePath: PLAN_FILE });
    expect(out).toContain("# <short imperative title>");
    // The marking protocol travels inside the plan file, not the approval message.
    expect(out).toContain("_Execution");
  });

  test("makes writing the plan file a hard requirement and warns against chat-only plans", () => {
    const out = composePlanPrompt("x", { planFilePath: PLAN_FILE });
    expect(out).toContain("MUST");
    expect(out.toLowerCase()).toContain(
      "further updates also should be applied and reflected in the plan file",
    );
    // The exact path is referenced for both the initial write and execution updates.
    expect(out.split(PLAN_FILE).length - 1).toBeGreaterThanOrEqual(2);
  });
});
