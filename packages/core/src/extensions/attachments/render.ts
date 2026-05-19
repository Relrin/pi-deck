import { open } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import type { PromptAttachment } from "../../protocol/commands.js";

export interface AttachmentsRenderOptions {
  projectPath: string;
  /**
   * Folder-enumeration hook. Default uses `git ls-files`-based discovery via the host helper;
   * tests can inject a deterministic fake.
   */
  listProjectFiles?: (cwd: string, limit?: number) => Promise<{ path: string }[]>;
  /** Maximum bytes inlined per file before truncation. */
  maxFileBytes?: number;
  /** Maximum number of lines inlined per file before truncation. */
  maxFileLines?: number;
  /** Maximum number of file kinds inlined per turn; remainder degrade to refs. */
  maxInlineFiles?: number;
  /** Maximum total bytes of inlined file content per turn; overflow degrades to refs. */
  maxTurnBytes?: number;
  /** Maximum directory entries listed inside a single folder attachment. */
  maxFolderEntries?: number;
}

export const ATTACHMENT_DEFAULTS = {
  maxFileBytes: 64 * 1024,
  maxFileLines: 800,
  maxInlineFiles: 8,
  maxTurnBytes: 256 * 1024,
  maxFolderEntries: 200,
} as const;

/**
 * Builds the `<attachments>…</attachments>` block that the attachments plugin prepends to the
 * user's turn as a CustomMessage. Pure async function so it's straightforward to unit-test
 * without spinning up pi-ai.
 *
 * Returns `null` when there's nothing worth sending (empty input or every entry failed).
 */
export async function renderAttachmentsBlock(
  attachments: PromptAttachment[],
  opts: AttachmentsRenderOptions,
): Promise<string | null> {
  if (attachments.length === 0) return null;

  const maxFileBytes = opts.maxFileBytes ?? ATTACHMENT_DEFAULTS.maxFileBytes;
  const maxFileLines = opts.maxFileLines ?? ATTACHMENT_DEFAULTS.maxFileLines;
  const maxInlineFiles = opts.maxInlineFiles ?? ATTACHMENT_DEFAULTS.maxInlineFiles;
  const maxTurnBytes = opts.maxTurnBytes ?? ATTACHMENT_DEFAULTS.maxTurnBytes;
  const maxFolderEntries = opts.maxFolderEntries ?? ATTACHMENT_DEFAULTS.maxFolderEntries;
  const listFiles = opts.listProjectFiles;

  const parts: string[] = [];
  const warnings: string[] = [];
  let inlineCount = 0;
  let totalBytes = 0;

  for (const a of attachments) {
    const absPath = isAbsolute(a.path) ? a.path : join(opts.projectPath, a.path);
    const relPath = toRelPath(opts.projectPath, absPath) || a.path;

    if (a.kind === "repo-ref") {
      parts.push(`<ref path=${JSON.stringify(relPath)} />`);
      continue;
    }

    if (a.kind === "folder") {
      if (!listFiles) {
        // No enumerator available — fall back to a bare ref so the agent still knows the path.
        parts.push(`<folder path=${JSON.stringify(relPath)} />`);
        continue;
      }
      const folderRel = relPath.endsWith("/") ? relPath : `${relPath}/`;
      let entries: { path: string }[];
      try {
        entries = await listFiles(opts.projectPath, maxFolderEntries * 10);
      } catch (err) {
        warnings.push(`${relPath}: folder listing failed (${(err as Error).message})`);
        parts.push(`<folder path=${JSON.stringify(relPath)} error="enumeration-failed" />`);
        continue;
      }
      const matches = entries.filter((e) => e.path === relPath || e.path.startsWith(folderRel));
      const shown = matches.slice(0, maxFolderEntries);
      const overflow = matches.length - shown.length;
      const tail = overflow > 0 ? `\n(+${overflow} more)` : "";
      parts.push(
        `<folder path=${JSON.stringify(relPath)}>\n${shown
          .map((e) => e.path)
          .join("\n")}${tail}\n</folder>`,
      );
      continue;
    }

    // a.kind === "file"
    if (inlineCount >= maxInlineFiles) {
      parts.push(`<ref path=${JSON.stringify(relPath)} note="inline-cap-reached" />`);
      warnings.push(`${relPath}: inline limit reached, sent as ref`);
      continue;
    }

    let read: BoundedReadResult;
    try {
      read = await readBounded(absPath, maxFileBytes);
    } catch (err) {
      const message = (err as NodeJS.ErrnoException).code ?? (err as Error).message;
      parts.push(
        `<file path=${JSON.stringify(relPath)} error=${JSON.stringify(String(message))} />`,
      );
      continue;
    }

    if (read.binary) {
      parts.push(`<file path=${JSON.stringify(relPath)} skipped="binary" />`);
      warnings.push(`${relPath}: skipped, binary file`);
      continue;
    }

    let content = read.content;
    let truncated = read.truncated;
    const lines = content.split("\n");
    if (lines.length > maxFileLines) {
      content = `${lines.slice(0, maxFileLines).join("\n")}\n…(${
        lines.length - maxFileLines
      } more lines)`;
      truncated = true;
    }
    const bytes = Buffer.byteLength(content, "utf8");
    if (totalBytes + bytes > maxTurnBytes) {
      parts.push(`<ref path=${JSON.stringify(relPath)} note="turn-budget-exhausted" />`);
      warnings.push(`${relPath}: turn budget exhausted, sent as ref`);
      continue;
    }
    totalBytes += bytes;
    inlineCount += 1;
    const attrs = truncated ? ' truncated="true"' : "";
    parts.push(`<file path=${JSON.stringify(relPath)}${attrs}>\n${content}\n</file>`);
  }

  if (parts.length === 0) return null;
  const warnBlock = warnings.length ? `\n<!-- pideck: ${warnings.join(" · ")} -->` : "";
  return `<attachments>${warnBlock}\n${parts.join("\n\n")}\n</attachments>`;
}

function toRelPath(projectPath: string, absPath: string): string {
  const rel = relative(projectPath, absPath);
  // `relative` returns Windows-style separators on win32; normalize so the block we emit and
  // the renderer chips are consistent regardless of host platform.
  return rel.split(/[\\/]/).filter(Boolean).join("/");
}

interface BoundedReadResult {
  content: string;
  binary: boolean;
  truncated: boolean;
}

/**
 * Reads at most `limit + 1` bytes from `absPath`, decides whether the file looks binary
 * (NUL byte in the first 1 KB), and decodes the prefix as UTF-8 with replacement. The extra
 * byte lets us flag truncation without scanning the rest of the file.
 */
async function readBounded(absPath: string, limit: number): Promise<BoundedReadResult> {
  const handle = await open(absPath, "r");
  try {
    const buf = Buffer.alloc(limit + 1);
    const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
    const slice = buf.subarray(0, bytesRead);
    const sniffLen = Math.min(slice.length, 1024);
    let binary = false;
    for (let i = 0; i < sniffLen; i += 1) {
      if (slice[i] === 0) {
        binary = true;
        break;
      }
    }
    if (binary) {
      return { content: "", binary: true, truncated: false };
    }
    const truncated = bytesRead > limit;
    const usable = truncated ? slice.subarray(0, limit) : slice;
    return { content: usable.toString("utf8"), binary: false, truncated };
  } finally {
    await handle.close();
  }
}
