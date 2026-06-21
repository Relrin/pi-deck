import { describe, expect, test } from "bun:test";
import { projectContextChars } from "../../src/worker/system-prompt-cost.js";

describe("projectContextChars", () => {
  test("measures the <project_context> envelope span, inclusive of both markers", () => {
    const block = `<project_context>\n\nProject-specific instructions and guidelines:\n\n<project_instructions path="AGENTS.md">\nhello world\n</project_instructions>\n\n</project_context>`;
    const prompt = `You are an expert coding assistant.\n\n${block}\nCurrent date: 2026-06-21`;
    expect(projectContextChars(prompt)).toBe(block.length);
  });

  test("returns 0 when the prompt has no project_context block", () => {
    expect(projectContextChars("Just a base prompt, no project context files.")).toBe(0);
  });

  test("returns 0 when the closing marker is missing (degrade safely, never throw)", () => {
    expect(projectContextChars("base...<project_context>\nunterminated content")).toBe(0);
  });

  test("returns 0 for an empty prompt", () => {
    expect(projectContextChars("")).toBe(0);
  });
});
