import { describe, expect, test } from "bun:test";
import {
  isReadOnlyBashCommand,
  isReadOnlyShellCommand,
} from "../../../src/extensions/agent-mode/bash-safety.js";

describe("isReadOnlyShellCommand — read-only commands", () => {
  const readOnly = [
    "ls",
    "ls -la",
    "ls -la src/",
    "pwd",
    "cd src && ls",
    "cat package.json",
    "head -n 20 file.ts",
    "tail -f log", // still read-only (no mutation)
    "tree -L 2",
    "find . -name '*.ts'",
    "find src -type f -name '*.test.ts'",
    "fd '\\.ts$'",
    "grep -rn TODO src",
    "rg --files",
    "echo hello",
    "wc -l src/index.ts",
    "du -sh .",
    "stat package.json",
    "sort file.txt",
    "sort -u file.txt | uniq -c",
    "cut -d, -f1 data.csv",
    "awk '{print $1}' file.txt",
    "awk '$1 > 5 {print}' nums.txt", // '>' inside quotes is a comparison, not a redirect
    "sed -n '1,20p' file.ts",
    "sed 's/foo/bar/' file.ts", // prints to stdout; no -i
    "diff a.txt b.txt",
    "cat a | grep foo | sort | uniq -c | head",
    "git status",
    "git log --oneline -20",
    "git diff HEAD~1",
    "git show abc123:file.ts",
    "git -C /repo log",
    "git ls-files",
    "grep foo file 2>/dev/null",
    "grep foo file 2>&1",
    "ls > /dev/null",
    "FOO=bar ls", // leading env assignment
    "basename /a/b/c.ts",
    "find . -name '*.ts' | head -5",
  ];

  for (const cmd of readOnly) {
    test(`allows: ${cmd}`, () => {
      expect(isReadOnlyShellCommand(cmd)).toBe(true);
    });
  }
});

describe("isReadOnlyShellCommand — mutating / unknown commands", () => {
  const mutating = [
    "rm -rf node_modules",
    "mv a b",
    "cp a b",
    "mkdir dist",
    "touch new.txt",
    "echo hi > out.txt", // write redirect
    "echo hi >> out.txt", // append redirect
    "cat in > out", // write redirect
    "sed -i 's/a/b/' file.ts", // in-place edit
    "sed -i.bak 's/a/b/' file.ts",
    "sed -ni 's/a/b/' file.ts", // combined short cluster with i
    "find . -name '*.tmp' -delete",
    "find . -type f -exec rm {} ;",
    "git commit -m wip",
    "git checkout -b feature",
    "git push",
    "git branch -d old", // branch isn't in the read-only subcommand set
    "git reset --hard",
    "npm install",
    "ls && rm file", // one mutating segment poisons the whole line
    "grep foo file | tee out.txt", // tee writes
    "find . | xargs rm", // xargs not allowlisted
    "node script.js", // can do anything
    "./build.sh",
    "tee out.txt",
    "dd if=/dev/zero of=disk",
    "kill -9 123",
  ];

  for (const cmd of mutating) {
    test(`blocks: ${cmd}`, () => {
      expect(isReadOnlyShellCommand(cmd)).toBe(false);
    });
  }

  test("empty / whitespace command is not read-only", () => {
    expect(isReadOnlyShellCommand("")).toBe(false);
    expect(isReadOnlyShellCommand("   ")).toBe(false);
  });
});

describe("isReadOnlyBashCommand — tool input shape", () => {
  test("reads the `command` field from the bash tool input", () => {
    expect(isReadOnlyBashCommand({ command: "ls -la" })).toBe(true);
    expect(isReadOnlyBashCommand({ command: "rm -rf /" })).toBe(false);
  });

  test("non-object / missing command is not read-only", () => {
    expect(isReadOnlyBashCommand({})).toBe(false);
    expect(isReadOnlyBashCommand(null)).toBe(false);
    expect(isReadOnlyBashCommand("ls")).toBe(false);
    expect(isReadOnlyBashCommand({ command: 123 })).toBe(false);
  });
});
