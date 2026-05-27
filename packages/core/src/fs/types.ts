import { z } from "zod";

/**
 * One entry in the filesystem tree. Paths are absolute, normalised to forward slashes
 * regardless of host platform — the renderer never has to do platform-specific joins.
 *
 * Symlinks are followed once and tagged with `linkedTo` so the UI can mark them and we can
 * break recursion on cycles. Symlink directories are NOT recursed into; their children stay
 * undefined.
 */
export interface FsNode {
  /** Absolute path with forward-slash separators. Stable identity for the row. */
  path: string;
  /** Final segment of the path (`foo.ts`, `src`, …). */
  name: string;
  type: "file" | "dir";
  /** Repo-relative path, also forward-slash. Empty string for the project root. */
  relPath: string;
  /** Set when this entry is a symlink; carries the link's target path as resolved. */
  linkedTo?: string;
  /** Present only on directories — undefined means "not walked yet" or "symlinked dir". */
  children?: FsNode[];
}

export const FsNodeSchema: z.ZodType<FsNode> = z.lazy(() =>
  z.object({
    path: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(["file", "dir"]),
    relPath: z.string(),
    linkedTo: z.string().optional(),
    children: z.array(FsNodeSchema).optional(),
  }),
);

/**
 * Emitted by the host's fs watch manager when files appear, vanish, or get renamed under a
 * project root. The renderer applies these deltas to its tree snapshot instead of refetching.
 */
export const FsChangeEventSchema = z.object({
  projectId: z.string().min(1),
  added: z.array(FsNodeSchema),
  /** Absolute paths that no longer exist. */
  removed: z.array(z.string()),
});
export type FsChangeEvent = z.infer<typeof FsChangeEventSchema>;

/**
 * Thrown by `ops.ts` when a requested path resolves outside the project root. The router
 * maps this to a `path_escape` RouterError so the renderer can surface a clear message
 * instead of a generic failure.
 */
export class PathEscapeError extends Error {
  constructor(public readonly attempted: string) {
    super(`Path escapes project root: ${attempted}`);
    this.name = "PathEscapeError";
  }
}

export class IllegalNameError extends Error {
  /** The illegal filename the caller attempted. (Named `attempted` to avoid colliding
   * with `Error.name`, which carries the error class name.) */
  public readonly attempted: string;
  constructor(attempted: string, reason: string) {
    super(`Illegal filename "${attempted}": ${reason}`);
    this.name = "IllegalNameError";
    this.attempted = attempted;
  }
}

export class FsExistsError extends Error {
  constructor(public readonly target: string) {
    super(`Path already exists: ${target}`);
    this.name = "FsExistsError";
  }
}
