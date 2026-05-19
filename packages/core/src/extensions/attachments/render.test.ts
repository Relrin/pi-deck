import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PromptAttachment } from "../../protocol/commands.js";
import { renderAttachmentsBlock } from "./render.js";

describe("renderAttachmentsBlock", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "pideck-attachments-"));
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  test("returns null for an empty list", async () => {
    const result = await renderAttachmentsBlock([], { projectPath });
    expect(result).toBeNull();
  });

  test("inlines a small text file", async () => {
    await writeFile(join(projectPath, "hello.ts"), "export const x = 1;\n");
    const result = await renderAttachmentsBlock([{ kind: "file", path: "hello.ts" }], {
      projectPath,
    });
    expect(result).toContain('<file path="hello.ts">');
    expect(result).toContain("export const x = 1;");
    expect(result).toContain("</file>");
    expect(result).not.toContain("truncated=");
  });

  test("truncates files exceeding the byte cap", async () => {
    const big = "x".repeat(200);
    await writeFile(join(projectPath, "big.txt"), big);
    const result = await renderAttachmentsBlock([{ kind: "file", path: "big.txt" }], {
      projectPath,
      maxFileBytes: 100,
      maxFileLines: 9999,
    });
    expect(result).toContain('truncated="true"');
    // The inlined content should be at most the byte cap (utf-8 ascii ⇒ char==byte).
    const match = result?.match(/<file [^>]*>\n([\s\S]*?)\n<\/file>/);
    expect(match).not.toBeNull();
    expect((match?.[1] ?? "").length).toBeLessThanOrEqual(100);
  });

  test("truncates files exceeding the line cap", async () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    await writeFile(join(projectPath, "many.txt"), lines);
    const result = await renderAttachmentsBlock([{ kind: "file", path: "many.txt" }], {
      projectPath,
      maxFileLines: 10,
    });
    expect(result).toContain('truncated="true"');
    expect(result).toContain("…(40 more lines)");
  });

  test("skips binary files (NUL byte in first 1KB)", async () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x01]);
    await writeFile(join(projectPath, "blob.png"), buf);
    const result = await renderAttachmentsBlock([{ kind: "file", path: "blob.png" }], {
      projectPath,
    });
    expect(result).toContain('<file path="blob.png" skipped="binary" />');
    expect(result).toContain("pideck:");
    expect(result).toContain("skipped, binary");
  });

  test("emits an error attribute when a file is missing", async () => {
    const result = await renderAttachmentsBlock([{ kind: "file", path: "nope.txt" }], {
      projectPath,
    });
    expect(result).toContain('<file path="nope.txt" error="ENOENT"');
  });

  test("inline cap degrades excess files to refs", async () => {
    const attachments: PromptAttachment[] = [];
    for (let i = 0; i < 10; i += 1) {
      const name = `f${i}.txt`;
      await writeFile(join(projectPath, name), `content ${i}\n`);
      attachments.push({ kind: "file", path: name });
    }
    const result = await renderAttachmentsBlock(attachments, {
      projectPath,
      maxInlineFiles: 8,
    });
    // First 8 inlined, last 2 emitted as refs with the inline-cap note.
    const fileMatches = result?.match(/<file path="f\d+\.txt">/g) ?? [];
    const refMatches = result?.match(/<ref path="f\d+\.txt" note="inline-cap-reached" \/>/g) ?? [];
    expect(fileMatches.length).toBe(8);
    expect(refMatches.length).toBe(2);
  });

  test("turn-byte cap degrades overflow files to refs", async () => {
    await writeFile(join(projectPath, "a.txt"), "a".repeat(80));
    await writeFile(join(projectPath, "b.txt"), "b".repeat(80));
    const result = await renderAttachmentsBlock(
      [
        { kind: "file", path: "a.txt" },
        { kind: "file", path: "b.txt" },
      ],
      { projectPath, maxTurnBytes: 100, maxFileBytes: 1024, maxFileLines: 9999 },
    );
    expect(result).toContain('<file path="a.txt">');
    expect(result).toContain('<ref path="b.txt" note="turn-budget-exhausted" />');
  });

  test("repo-ref is emitted as a bare ref tag", async () => {
    const result = await renderAttachmentsBlock([{ kind: "repo-ref", path: "owner/repo#main" }], {
      projectPath,
    });
    expect(result).toContain('<ref path="owner/repo#main" />');
  });

  test("folder enumeration listed and capped", async () => {
    const entries = Array.from({ length: 25 }, (_, i) => ({ path: `src/util/${i}.ts` }));
    const result = await renderAttachmentsBlock([{ kind: "folder", path: "src/util" }], {
      projectPath,
      listProjectFiles: async () => entries,
      maxFolderEntries: 10,
    });
    expect(result).toContain('<folder path="src/util">');
    expect(result).toContain("src/util/0.ts");
    expect(result).toContain("src/util/9.ts");
    expect(result).not.toContain("src/util/10.ts");
    expect(result).toContain("(+15 more)");
  });

  test("folder with no enumerator falls back to a bare ref", async () => {
    const result = await renderAttachmentsBlock([{ kind: "folder", path: "src/util" }], {
      projectPath,
    });
    expect(result).toContain('<folder path="src/util" />');
  });

  test("folder enumeration failure surfaces as an error attribute", async () => {
    const result = await renderAttachmentsBlock([{ kind: "folder", path: "src" }], {
      projectPath,
      listProjectFiles: async () => {
        throw new Error("git failed");
      },
    });
    expect(result).toContain('error="enumeration-failed"');
    expect(result).toContain("git failed");
  });

  test("absolute paths inside the project resolve to project-relative form", async () => {
    await writeFile(join(projectPath, "abs.txt"), "data\n");
    const result = await renderAttachmentsBlock(
      [{ kind: "file", path: join(projectPath, "abs.txt") }],
      { projectPath },
    );
    expect(result).toContain('<file path="abs.txt">');
  });
});
