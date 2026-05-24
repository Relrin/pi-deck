import { z } from "zod";

export const GitChangeStatusSchema = z.enum(["M", "A", "D", "R", "C", "U", "?"]);
export type GitChangeStatus = z.infer<typeof GitChangeStatusSchema>;

export const GitChangeSchema = z.object({
  path: z.string().min(1),
  status: GitChangeStatusSchema,
  /** A staged variant of this path exists (X half of porcelain XY is non-dot). */
  staged: z.boolean(),
  /** True when the path is untracked (`?` rows in porcelain v2). */
  untracked: z.boolean(),
  /** Source path for renames; present iff status === "R". */
  oldPath: z.string().optional(),
  /** Added lines vs HEAD. 0 when unknown or unavailable (e.g. untracked, pre-initial-commit). */
  add: z.number().int().nonnegative(),
  /** Removed lines vs HEAD. 0 when unknown or unavailable. */
  del: z.number().int().nonnegative(),
});
export type GitChange = z.infer<typeof GitChangeSchema>;

export const GitStatusSchema = z.object({
  isRepo: z.boolean(),
  /** Absolute repo root from `rev-parse --show-toplevel`. */
  root: z.string().optional(),
  /** Current branch, or undefined when HEAD is detached. */
  branch: z.string().optional(),
  detached: z.boolean().optional(),
  /** Upstream ref name (e.g. `origin/main`). Undefined when there is none. */
  upstream: z.string().optional(),
  ahead: z.number().int().nonnegative().optional(),
  behind: z.number().int().nonnegative().optional(),
  /** Names of configured remotes from `git remote` (e.g. `["origin", "upstream"]`). Empty
   * array means the repo is purely local — no place to pull from / push to / open PRs
   * against. The git sidebar uses this to grey out the remote-action buttons. */
  remotes: z.array(z.string()),
  changes: z.array(GitChangeSchema),
  /** Aggregated +/- across `changes`; drives the diffbar header. */
  totals: z.object({
    add: z.number().int().nonnegative(),
    del: z.number().int().nonnegative(),
  }),
});
export type GitStatus = z.infer<typeof GitStatusSchema>;

export const GitCommitSchema = z.object({
  sha: z.string().min(7),
  shortSha: z.string().min(4),
  subject: z.string(),
  authorName: z.string(),
  authorEmail: z.string(),
  /** ISO-8601 (strict) author timestamp. */
  authoredAt: z.string(),
  /** ISO-8601 (strict) committer timestamp. */
  committedAt: z.string(),
});
export type GitCommit = z.infer<typeof GitCommitSchema>;

export const GitHunkSchema = z.object({
  /** 1-based start line in the pre-image (old file). 0 for additions to an empty file. */
  oldStart: z.number().int().nonnegative(),
  /** Lines removed from the pre-image; equal to `del`. */
  oldLines: z.number().int().nonnegative(),
  /** 1-based start line in the post-image (new file). 0 when the hunk is a pure deletion. */
  newStart: z.number().int().nonnegative(),
  /** Lines present in the post-image; equal to `add`. */
  newLines: z.number().int().nonnegative(),
  /** Convenience mirror of `newLines`. */
  add: z.number().int().nonnegative(),
  /** Convenience mirror of `oldLines`. */
  del: z.number().int().nonnegative(),
});
export type GitHunk = z.infer<typeof GitHunkSchema>;

export const GitBranchInfoSchema = z.object({
  name: z.string().min(1),
  isCurrent: z.boolean(),
  /** ISO-8601 committer date of the branch tip. */
  lastActivityAt: z.string().optional(),
});
export type GitBranchInfo = z.infer<typeof GitBranchInfoSchema>;
