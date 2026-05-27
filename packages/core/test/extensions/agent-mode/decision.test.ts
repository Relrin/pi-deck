import { describe, expect, test } from "bun:test";
import { isAbsolute, join, resolve, sep } from "node:path";
import {
  decideToolCall,
  isEditPathAllowed,
  isPlanFileWrite,
} from "../../../src/extensions/agent-mode/decision.js";

const PROJECT = isAbsolute("/repo") ? "/repo" : resolve("C:\\repo");
const PLAN_FILE = join(PROJECT, ".pi-deck", "plans", "abc-123.md");

describe("decideToolCall", () => {
  test("plan mode blocks bash/edit/write with a stable reason", () => {
    for (const toolName of ["bash", "edit", "write"]) {
      const d = decideToolCall({
        mode: "plan",
        toolName,
        input: {},
        editAllowlist: [PROJECT],
        projectPath: PROJECT,
      });
      expect(d.kind).toBe("block");
      if (d.kind === "block") {
        expect(d.reason).toContain("Plan mode");
      }
    }
  });

  test("plan mode allows read-only tools", () => {
    for (const toolName of ["read", "grep", "find", "ls"]) {
      const d = decideToolCall({
        mode: "plan",
        toolName,
        input: {},
        editAllowlist: [],
        projectPath: PROJECT,
      });
      expect(d.kind).toBe("allow");
    }
  });

  test("ask mode prompts for every mutating tool", () => {
    for (const toolName of ["bash", "edit", "write"]) {
      const d = decideToolCall({
        mode: "ask",
        toolName,
        input: {},
        editAllowlist: [PROJECT],
        projectPath: PROJECT,
      });
      expect(d.kind).toBe("approve");
    }
  });

  test("ask mode allows read-only tools", () => {
    for (const toolName of ["read", "grep", "find", "ls"]) {
      const d = decideToolCall({
        mode: "ask",
        toolName,
        input: {},
        editAllowlist: [],
        projectPath: PROJECT,
      });
      expect(d.kind).toBe("allow");
    }
  });

  test("accept-edits allows edits inside the allowlist", () => {
    const inside = join(PROJECT, "src", "foo.ts");
    const d = decideToolCall({
      mode: "accept-edits",
      toolName: "edit",
      input: { path: inside },
      editAllowlist: [PROJECT],
      projectPath: PROJECT,
    });
    expect(d.kind).toBe("allow");
  });

  test("accept-edits prompts for edits outside the allowlist", () => {
    const d = decideToolCall({
      mode: "accept-edits",
      toolName: "edit",
      input: { path: "/outside/x.ts" },
      editAllowlist: [PROJECT],
      projectPath: PROJECT,
    });
    expect(d.kind).toBe("approve");
  });

  test("accept-edits always prompts for bash even inside the allowlist", () => {
    const d = decideToolCall({
      mode: "accept-edits",
      toolName: "bash",
      input: { command: "ls" },
      editAllowlist: [PROJECT],
      projectPath: PROJECT,
    });
    expect(d.kind).toBe("approve");
  });

  test("accept-edits prompts when edit input has no path", () => {
    const d = decideToolCall({
      mode: "accept-edits",
      toolName: "edit",
      input: {},
      editAllowlist: [PROJECT],
      projectPath: PROJECT,
    });
    expect(d.kind).toBe("approve");
  });

  test("plan mode allows write to the exact plan file", () => {
    for (const toolName of ["write", "edit"]) {
      const d = decideToolCall({
        mode: "plan",
        toolName,
        input: { path: PLAN_FILE },
        editAllowlist: [PROJECT],
        projectPath: PROJECT,
        planFilePath: PLAN_FILE,
      });
      expect(d.kind).toBe("allow");
    }
  });

  test("plan mode still blocks writes to sibling paths near the plan file", () => {
    for (const sibling of [
      `${PLAN_FILE}.bak`,
      join(PROJECT, ".pi-deck", "plans", "other.md"),
      join(PROJECT, ".pi-deck", "plans"),
      join(PROJECT, "PLAN.md"),
    ]) {
      const d = decideToolCall({
        mode: "plan",
        toolName: "write",
        input: { path: sibling },
        editAllowlist: [PROJECT],
        projectPath: PROJECT,
        planFilePath: PLAN_FILE,
      });
      expect(d.kind).toBe("block");
    }
  });

  test("plan mode still blocks bash even when planFilePath is set", () => {
    const d = decideToolCall({
      mode: "plan",
      toolName: "bash",
      input: { command: "echo hi >> plan.md" },
      editAllowlist: [PROJECT],
      projectPath: PROJECT,
      planFilePath: PLAN_FILE,
    });
    expect(d.kind).toBe("block");
  });

  test("custom mutating-tool set overrides the default", () => {
    const custom = new Set(["dangerous"]);
    const d = decideToolCall({
      mode: "plan",
      toolName: "dangerous",
      input: {},
      editAllowlist: [],
      projectPath: PROJECT,
      mutatingTools: custom,
    });
    expect(d.kind).toBe("block");
    // bash is no longer in the set, so plan would allow it.
    const d2 = decideToolCall({
      mode: "plan",
      toolName: "bash",
      input: {},
      editAllowlist: [],
      projectPath: PROJECT,
      mutatingTools: custom,
    });
    expect(d2.kind).toBe("allow");
  });
});

describe("isEditPathAllowed", () => {
  test("empty allowlist denies everything", () => {
    expect(isEditPathAllowed([], join(PROJECT, "x"), PROJECT)).toBe(false);
  });

  test("exact match is allowed", () => {
    const p = join(PROJECT, "src", "foo.ts");
    expect(isEditPathAllowed([p], p, PROJECT)).toBe(true);
  });

  test("descendant of a root is allowed", () => {
    const root = join(PROJECT, "src");
    const child = join(PROJECT, "src", "deep", "file.ts");
    expect(isEditPathAllowed([root], child, PROJECT)).toBe(true);
  });

  test("sibling that shares a name prefix is not allowed", () => {
    const root = join(PROJECT, "src");
    const sibling = `${root}foo${sep}file.ts`;
    expect(isEditPathAllowed([root], sibling, PROJECT)).toBe(false);
  });

  test("relative paths resolve against project root", () => {
    expect(isEditPathAllowed(["src"], join("src", "foo.ts"), PROJECT)).toBe(true);
  });

  test("any matching root in the list is sufficient", () => {
    const root1 = join(PROJECT, "src");
    const root2 = join(PROJECT, "tests");
    const child = join(PROJECT, "tests", "a.test.ts");
    expect(isEditPathAllowed([root1, root2], child, PROJECT)).toBe(true);
  });
});

describe("isPlanFileWrite", () => {
  test("matches the exact resolved path for write/edit", () => {
    expect(isPlanFileWrite("write", { path: PLAN_FILE }, PLAN_FILE, PROJECT)).toBe(true);
    expect(isPlanFileWrite("edit", { path: PLAN_FILE }, PLAN_FILE, PROJECT)).toBe(true);
  });

  test("rejects non-write/edit tools", () => {
    expect(isPlanFileWrite("bash", { path: PLAN_FILE }, PLAN_FILE, PROJECT)).toBe(false);
    expect(isPlanFileWrite("read", { path: PLAN_FILE }, PLAN_FILE, PROJECT)).toBe(false);
  });

  test("rejects when planFilePath is absent", () => {
    expect(isPlanFileWrite("write", { path: PLAN_FILE }, undefined, PROJECT)).toBe(false);
  });

  test("rejects paths that share a prefix but aren't the file", () => {
    expect(isPlanFileWrite("write", { path: `${PLAN_FILE}.bak` }, PLAN_FILE, PROJECT)).toBe(false);
    expect(isPlanFileWrite("write", { path: undefined }, PLAN_FILE, PROJECT)).toBe(false);
  });
});
