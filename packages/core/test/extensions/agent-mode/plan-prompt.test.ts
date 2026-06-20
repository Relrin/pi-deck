import { describe, expect, test } from "bun:test";
import { composePlanPrompt } from "../../../src/extensions/agent-mode/plan-prompt.js";

const PLAN_FILE = "/repo/.pi-deck/plans/abc-123.md";

describe("composePlanPrompt", () => {
  test("appends the Plan Mode section to the original prompt", () => {
    const out = composePlanPrompt("ORIGINAL SYSTEM PROMPT", { planFilePath: PLAN_FILE });
    expect(out.startsWith("ORIGINAL SYSTEM PROMPT")).toBe(true);
    expect(out).toContain("# Plan Mode");
    expect(out).toContain(PLAN_FILE);
  });

  test("tells the agent read-only shell exploration is allowed (not blocked)", () => {
    const out = composePlanPrompt("x", { planFilePath: PLAN_FILE });
    // The agent previously assumed "bash is blocked in plan mode" and fell back to reading
    // directories (EISDIR). The prompt must green-light read-only shell + directory listing.
    expect(out).toContain("read-only shell commands");
    expect(out).toContain("ls");
    expect(out.toLowerCase()).toContain("bash");
  });

  test("still tells the agent that workspace-mutating actions are blocked", () => {
    const out = composePlanPrompt("x", { planFilePath: PLAN_FILE });
    expect(out).toContain("BLOCKS");
    expect(out).toContain("sed -i");
  });
});
