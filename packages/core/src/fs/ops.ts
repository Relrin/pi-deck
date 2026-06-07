import { rename as fsRename, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { FsExistsError, IllegalNameError, PathEscapeError } from "./types.js";

/**
 * Hook for the desktop bridge to inject Electron's `shell.trashItem` — keeps the core
 * package free of an Electron import (it's also consumed from non-desktop code paths).
 * Default raises so misconfigured environments fail loudly rather than silently
 * permanently-deleting files.
 */
export type TrashImpl = (absPath: string) => Promise<void>;
let trashImpl: TrashImpl | undefined;
export function setTrashImpl(impl: TrashImpl): void {
  trashImpl = impl;
}

/**
 * Reserved Windows device names (case-insensitive). Even with an extension, paths like
 * `CON.txt` are blocked by the OS so we reject early with a clear error.
 */
const WINDOWS_RESERVED = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

export interface CreateFileArgs {
  projectRoot: string;
  /** Absolute path of the parent directory where the new file should land. */
  parentDir: string;
  /** Basename of the new file (no path separators). */
  name: string;
}

export interface CreateFolderArgs {
  projectRoot: string;
  parentDir: string;
  name: string;
}

export interface RenameArgs {
  projectRoot: string;
  fromPath: string;
  /** Just the new basename; the parent dir is preserved. */
  toName: string;
}

export interface MoveArgs {
  projectRoot: string;
  /** Absolute path of the source file or folder. */
  fromPath: string;
  /** Absolute path of the destination directory the item moves into. The basename is
   * preserved; only the parent directory changes. */
  toDir: string;
}

export interface DeleteArgs {
  projectRoot: string;
  /** Absolute paths to trash (files or directories). */
  paths: string[];
}

export async function createFile(args: CreateFileArgs): Promise<string> {
  validateName(args.name);
  const root = resolve(args.projectRoot);
  const parent = resolve(args.parentDir);
  assertInsideRoot(parent, root);
  const target = resolve(parent, args.name);
  assertInsideRoot(target, root);
  if (await exists(target)) throw new FsExistsError(target);
  await mkdir(parent, { recursive: true });
  // `wx` flag = "write, fail if exists" — races between an external touch and our create
  // surface as EEXIST instead of silently overwriting someone else's bytes.
  await writeFile(target, "", { flag: "wx" });
  return target;
}

export async function createFolder(args: CreateFolderArgs): Promise<string> {
  validateName(args.name);
  const root = resolve(args.projectRoot);
  const parent = resolve(args.parentDir);
  assertInsideRoot(parent, root);
  const target = resolve(parent, args.name);
  assertInsideRoot(target, root);
  if (await exists(target)) throw new FsExistsError(target);
  await mkdir(target, { recursive: false });
  return target;
}

export async function rename(args: RenameArgs): Promise<string> {
  validateName(args.toName);
  const root = resolve(args.projectRoot);
  const from = resolve(args.fromPath);
  assertInsideRoot(from, root);
  const target = resolve(dirname(from), args.toName);
  assertInsideRoot(target, root);
  if (from === target) return target;
  if (await exists(target)) throw new FsExistsError(target);
  await fsRename(from, target);
  return target;
}

/**
 * Move `fromPath` into the directory `toDir`, keeping its basename. Backs the file tree's
 * cross-directory drag-and-drop (`rename` only re-bases within the same dir). Rejects moves
 * that would land a directory inside itself or one of its own descendants — chokidar would
 * otherwise emit a confusing add/remove storm and git would lose the path entirely.
 */
export async function move(args: MoveArgs): Promise<string> {
  const root = resolve(args.projectRoot);
  const from = resolve(args.fromPath);
  assertInsideRoot(from, root);
  const destDir = resolve(args.toDir);
  assertInsideRoot(destDir, root);
  const target = resolve(destDir, basename(from));
  assertInsideRoot(target, root);
  // Dropping onto the current parent is a no-op — succeed silently so the UI's optimistic
  // move doesn't bounce back with an error.
  if (from === target) return target;
  // Block self / descendant moves: if `target` resolves to `from` or anything beneath it,
  // `relative(from, target)` produces a path that neither escapes upward (`..`) nor is
  // absolute.
  const intoSelf = relative(from, target);
  if (intoSelf === "" || (!intoSelf.startsWith("..") && !isAbsolute(intoSelf))) {
    throw new Error("Cannot move a directory into itself");
  }
  if (await exists(target)) throw new FsExistsError(target);
  await mkdir(destDir, { recursive: true });
  await fsRename(from, target);
  return target;
}

export async function trashPaths(args: DeleteArgs): Promise<void> {
  if (!trashImpl) {
    throw new Error(
      "trashItem implementation not installed — desktop bridge must call setTrashImpl",
    );
  }
  const root = resolve(args.projectRoot);
  // Validate every path before moving anything. Half-trashing a batch because the third
  // path failed validation would be worse than failing the whole call.
  for (const p of args.paths) {
    const abs = resolve(p);
    assertInsideRoot(abs, root);
    // The path may have already been removed by an earlier op (e.g. nested-in-folder); we
    // accept that and skip the per-path trash call below.
  }
  for (const p of args.paths) {
    const abs = resolve(p);
    if (!(await exists(abs))) continue;
    await trashImpl(abs);
  }
}

/** Dominant on-disk line ending. The editor edits an LF body and re-applies this on save. */
export type Eol = "lf" | "crlf";

/** Files larger than this are opened read-only with empty content (the editor shows a notice). */
const MAX_EDITABLE_BYTES = 2 * 1024 * 1024;

export interface ReadTextFileArgs {
  projectRoot: string;
  /** Absolute path of the file to read; must resolve inside the project root. */
  path: string;
}

export interface ReadTextFileResult {
  /** UTF-8 text normalised to LF. Empty string when `binary` or `tooLarge`. */
  content: string;
  /** Dominant line ending detected on disk. */
  eol: Eol;
  /** A NUL byte was found in the sniffed prefix — treat as non-editable. */
  binary: boolean;
  /** File exceeded `MAX_EDITABLE_BYTES`. */
  tooLarge: boolean;
  sizeBytes: number;
}

export interface WriteTextFileArgs {
  projectRoot: string;
  path: string;
  /** Editor buffer content (LF-separated). */
  content: string;
  /** Line ending to materialise on disk. */
  eol: Eol;
}

/**
 * Read a project file for the editor. Guards against binary blobs (NUL sniff) and very large
 * files (size cap) by returning a flag + empty content rather than streaming megabytes into the
 * renderer. The on-disk EOL is detected and reported so `writeTextFile` can round-trip it; the
 * returned `content` is always LF-normalised (CodeMirror edits LF internally).
 */
export async function readTextFile(args: ReadTextFileArgs): Promise<ReadTextFileResult> {
  const root = resolve(args.projectRoot);
  const target = resolve(args.path);
  assertInsideRoot(target, root);
  const info = await stat(target);
  const sizeBytes = info.size;
  if (sizeBytes > MAX_EDITABLE_BYTES) {
    return { content: "", eol: "lf", binary: false, tooLarge: true, sizeBytes };
  }
  const buf = await readFile(target);
  if (looksBinary(buf)) {
    return { content: "", eol: "lf", binary: true, tooLarge: false, sizeBytes };
  }
  let text = buf.toString("utf8");
  // Strip a leading UTF-8 BOM so it doesn't surface as a stray glyph in the gutter.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const eol = detectEol(text);
  const content = text.replace(/\r\n?/g, "\n");
  return { content, eol, binary: false, tooLarge: false, sizeBytes };
}

/** Persist editor content, re-applying `eol`. Content arrives LF-separated from the renderer. */
export async function writeTextFile(args: WriteTextFileArgs): Promise<void> {
  const root = resolve(args.projectRoot);
  const target = resolve(args.path);
  assertInsideRoot(target, root);
  const lf = args.content.replace(/\r\n?/g, "\n");
  const body = args.eol === "crlf" ? lf.replace(/\n/g, "\r\n") : lf;
  await writeFile(target, body, "utf8");
}

function detectEol(text: string): Eol {
  let crlf = 0;
  let lf = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) !== 10) continue; // \n
    if (i > 0 && text.charCodeAt(i - 1) === 13)
      crlf++; // \r\n
    else lf++;
  }
  return crlf > lf ? "crlf" : "lf";
}

function looksBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

function validateName(name: string): void {
  if (!name || name.length === 0) {
    throw new IllegalNameError(name, "name cannot be empty");
  }
  if (name === "." || name === "..") {
    throw new IllegalNameError(name, "reserved path segment");
  }
  if (name.includes("/") || name.includes("\\")) {
    throw new IllegalNameError(name, "path separators are not allowed in names");
  }
  if (name.includes("\0")) {
    throw new IllegalNameError(name, "null byte is not allowed");
  }
  // Trailing dots / spaces are silently stripped on Windows and create files that the
  // shell can't address — reject them rather than land in a confusing state.
  if (/[\s.]$/.test(name)) {
    throw new IllegalNameError(name, "name cannot end in a space or dot");
  }
  const stem = name.split(".")[0]?.toUpperCase() ?? "";
  if (WINDOWS_RESERVED.has(stem)) {
    throw new IllegalNameError(name, `${stem} is a reserved device name on Windows`);
  }
}

function assertInsideRoot(target: string, root: string): void {
  if (!isAbsolute(target) || !isAbsolute(root)) {
    throw new PathEscapeError(target);
  }
  const rel = relative(root, target);
  if (rel === "") return;
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new PathEscapeError(target);
  }
  // Sanity check on Windows: relative across drive letters returns an absolute-looking path.
  if (sep === "\\" && /^[A-Za-z]:/.test(rel)) {
    throw new PathEscapeError(target);
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
