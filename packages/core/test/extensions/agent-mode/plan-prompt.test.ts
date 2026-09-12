import { describe, expect, test } from "bun:test";
import { composePlanPrompt } from "../../../src/extensions/agent-mode/plan-prompt.js";
import { LOCALES } from "../../../src/i18n/locale.js";
import { PLAN_VOCABULARY } from "../../../src/i18n/plan-vocabulary.js";

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

/**
 * The invariants that must hold in every locale. The prose is free to be translated; these are
 * the things the renderer parses, so if a translation drops one the user gets a plan card with no
 * Approve button and a progress panel with no steps.
 */
describe.each([...LOCALES])("composePlanPrompt — %s invariants", (locale) => {
  const out = composePlanPrompt("x", { planFilePath: PLAN_FILE, locale });
  const v = PLAN_VOCABULARY[locale];

  test("opens with the localized Plan Mode header", () => {
    expect(out).toContain(v.header);
  });

  test("names the plan file at least twice — for the initial write and for progress updates", () => {
    expect(out.split(PLAN_FILE).length - 1).toBeGreaterThanOrEqual(2);
  });

  test("documents the checkbox markers verbatim, untranslated", () => {
    expect(out).toContain("- [ ]");
    expect(out).toContain("[~]");
    expect(out).toContain("[x]");
  });

  test("asks for an H1 title", () => {
    expect(out).toContain(`# ${v.titlePlaceholder}`);
  });

  test("uses exactly the four section headings from the shared vocabulary", () => {
    for (const heading of Object.values(v.sections)) {
      expect(out).toContain(`**${heading}**`);
    }
  });

  test("offers the localized CAPS step labels", () => {
    for (const label of v.labels) {
      expect(out).toContain(label);
    }
  });

  test("mandates the execution note and the closing line verbatim", () => {
    expect(out).toContain(v.executionNote);
    expect(out).toContain(v.closingLine);
  });
});
