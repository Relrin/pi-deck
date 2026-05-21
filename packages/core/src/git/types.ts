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

export const GitBranchInfoSchema = z.object({
  name: z.string().min(1),
  isCurrent: z.boolean(),
  /** ISO-8601 committer date of the branch tip. */
  lastActivityAt: z.string().optional(),
});
export type GitBranchInfo = z.infer<typeof GitBranchInfoSchema>;
