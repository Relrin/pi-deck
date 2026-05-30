import { describe, expect, test } from "bun:test";
import { deriveAllowKey } from "./deriveAllowKey";

describe("deriveAllowKey", () => {
  test("bash uses the first command token", () => {
    expect(deriveAllowKey("bash", { command: "mkdir -p ~/.config/pi/mcp" })).toBe("mkdir");
    expect(deriveAllowKey("bash", { command: "  npm   install  " })).toBe("npm");
  });

  test("shell follows the same rule as bash", () => {
    expect(deriveAllowKey("shell", { command: "ls -la" })).toBe("ls");
  });

  test("falls back to the tool name when the command is missing / malformed", () => {
    expect(deriveAllowKey("bash", {})).toBe("bash");
    expect(deriveAllowKey("bash", null)).toBe("bash");
    expect(deriveAllowKey("bash", { command: 42 })).toBe("bash");
    expect(deriveAllowKey("bash", { command: "   " })).toBe("bash");
  });

  test("non-bash tools always key on the tool name", () => {
    expect(deriveAllowKey("read", { path: "src/foo.ts" })).toBe("read");
    expect(deriveAllowKey("edit", {})).toBe("edit");
    expect(deriveAllowKey("grep", { pattern: "x" })).toBe("grep");
  });
});
