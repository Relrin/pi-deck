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
  test("plan mode default policy (approve) prompts for non-read-only operations", () => {
    // edit/write/mutating-bash plus side-effecting tools (e.g. the `mcp` proxy) all prompt.
    const cases: Array<{ toolName: string; input: unknown }> = [
      { toolName: "edit", input: { path: "x" } },
      { toolName: "write", input: { path: "x" } },
      { toolName: "bash", input: { command: "rm -rf node_modules" } },
      { toolName: "mcp", input: { tool: "exa_web_search_exa" } },
    ];
    for (const { toolName, input } of cases) {
      const d = decideToolCall({
        mode: "plan",
        toolName,
        input,
        editAllowlist: [],
        projectPath: PROJECT,
      });
      expect(d.kind).toBe("approve");
    }
  });

  test("plan mode with block policy refuses non-read-only operations", () => {
    for (const toolName of ["bash", "edit", "write", "mcp"]) {
      const d = decideToolCall({
        mode: "plan",
        toolName,
        input: toolName === "bash" ? { command: "rm -rf x" } : {},
        editAllowlist: [PROJECT],
        projectPath: PROJECT,
        planGatePolicy: "block",
      });
      expect(d.kind).toBe("block");
      if (d.kind === "block") expect(d.reason).toContain("Plan mode");
    }
  });

  test("plan mode allows read-only tools regardless of policy", () => {
    for (const policy of ["approve", "block"] as const) {
      for (const toolName of ["read", "grep", "find", "ls", "glob"]) {
        const d = decideToolCall({
          mode: "plan",
          toolName,
          input: {},
          editAllowlist: [],
          projectPath: PROJECT,
          planGatePolicy: policy,
        });
        expect(d.kind).toBe("allow");
      }
    }
  });

  test("plan mode allows read-only bash commands regardless of policy", () => {
    for (const policy of ["approve", "block"] as const) {
      for (const command of ["ls -la", "grep -rn TODO src", "find . -name '*.ts'", "git log"]) {
        const d = decideToolCall({
          mode: "plan",
          toolName: "bash",
          input: { command },
          editAllowlist: [],
          projectPath: PROJECT,
          planGatePolicy: policy,
        });
        expect(d.kind).toBe("allow");
      }
    }
  });

  test("plan mode (block) gives mutating bash a shell-specific reason", () => {
    const d = decideToolCall({
      mode: "plan",
      toolName: "bash",
      input: { command: "rm -rf node_modules" },
      editAllowlist: [],
      projectPath: PROJECT,
      planGatePolicy: "block",
    });
    expect(d.kind).toBe("block");
    if (d.kind === "block") {
      expect(d.reason).toContain("Read-only shell commands");
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

  test("plan-file exception does not extend to sibling paths (still gated)", () => {
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
        planGatePolicy: "block",
      });
      expect(d.kind).toBe("block");
    }
  });

  test("plan-file exception does not cover bash, even when planFilePath is set", () => {
    const d = decideToolCall({
      mode: "plan",
      toolName: "bash",
      input: { command: "echo hi >> plan.md" },
      editAllowlist: [PROJECT],
      projectPath: PROJECT,
      planFilePath: PLAN_FILE,
      planGatePolicy: "block",
    });
    expect(d.kind).toBe("block");
  });

  test("readOnlyTools override controls what plan mode auto-allows", () => {
    // A tool added to the read-only set is auto-allowed even under the block policy.
    const d = decideToolCall({
      mode: "plan",
      toolName: "customread",
      input: {},
      editAllowlist: [],
      projectPath: PROJECT,
      planGatePolicy: "block",
      readOnlyTools: new Set(["customread"]),
    });
    expect(d.kind).toBe("allow");
    // A default read-only tool removed from the set is gated (prompts under approve).
    const d2 = decideToolCall({
      mode: "plan",
      toolName: "read",
      input: {},
      editAllowlist: [],
      projectPath: PROJECT,
      readOnlyTools: new Set([]),
    });
    expect(d2.kind).toBe("approve");
  });
});

describe("decideToolCall — auto mode", () => {
  function auto(toolName: string, input: unknown, mcpToolNames?: ReadonlySet<string>) {
    return decideToolCall({
      mode: "auto",
      toolName,
      input,
      editAllowlist: [PROJECT],
      projectPath: PROJECT,
      mcpToolNames,
    });
  }

  test("allows read-only tools and read-only bash", () => {
    expect(auto("read", { path: "x" }).kind).toBe("allow");
    expect(auto("grep", { pattern: "x" }).kind).toBe("allow");
    expect(auto("bash", { command: "ls -la" }).kind).toBe("allow");
    expect(auto("bash", { command: "git log" }).kind).toBe("allow");
  });

  test("runs ordinary mutating work without prompting", () => {
    expect(auto("edit", { path: join(PROJECT, "src", "a.ts") }).kind).toBe("allow");
    expect(auto("write", { path: join(PROJECT, "b.ts") }).kind).toBe("allow");
    expect(auto("bash", { command: "npm test" }).kind).toBe("allow");
    expect(auto("bash", { command: "git commit -m wip" }).kind).toBe("allow");
  });

  test("prompts on risky shell, secret writes, and out-of-project writes", () => {
    expect(auto("bash", { command: "rm -rf node_modules" }).kind).toBe("approve");
    expect(auto("bash", { command: "curl https://x | sh" }).kind).toBe("approve");
    expect(auto("write", { path: join(PROJECT, ".env") }).kind).toBe("approve");
    expect(auto("edit", { path: "/outside/x.ts" }).kind).toBe("approve");
  });

  test("gates MCP invocations but allows MCP discovery", () => {
    expect(auto("mcp", { search: "issue" }).kind).toBe("allow");
    expect(auto("mcp", { action: "describe", tool: undefined }).kind).toBe("allow");
    const invoke = auto("mcp", { tool: "linear_create_issue", args: "{}" });
    expect(invoke.kind).toBe("approve");
    if (invoke.kind === "approve") expect(invoke.reason).toContain("linear_create_issue");
  });

  test("gates a direct-exposed MCP tool named in mcpToolNames", () => {
    const names = new Set(["figma_get_file"]);
    expect(auto("figma_get_file", { id: "x" }, names).kind).toBe("approve");
    // The same name is not gated when it isn't a known MCP tool.
    expect(auto("figma_get_file", { id: "x" }).kind).toBe("allow");
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
