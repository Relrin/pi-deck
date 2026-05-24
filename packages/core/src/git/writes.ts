import { GitCommandError, NotARepoError, runGit } from "./runner.js";

export interface CommitOptions {
  message: string;
  amend?: boolean;
  /** Paths to `git add` immediately before the commit. If omitted, whatever is already
   * staged gets committed. Untracked paths are added as new files. */
  paths?: string[];
}

export interface CommitResult {
  sha: string;
  shortSha: string;
  subject: string;
}

/**
 * Stage the requested paths (if any), then commit. The amend flag rewrites HEAD; callers
 * are expected to have warned the user that this only makes sense on un-pushed commits.
 *
 * Errors map to typed throws: `git_failed` for hook rejections, `NotARepoError` for the
 * path-isn't-a-repo case (the renderer treats that as a programming bug, not a UX path).
 */
export async function commit(root: string, opts: CommitOptions): Promise<CommitResult> {
  const message = opts.message.trim();
  if (!message) {
    throw new GitCommandError("Commit message cannot be empty", 1, "empty message");
  }
  if (opts.paths && opts.paths.length > 0) {
    // `git add --` accepts file paths verbatim; the explicit `--` separator guards against
    // path strings that begin with a dash (rare in practice but easy to defend against).
    await runGit(root, ["add", "--", ...opts.paths]);
  }
  const args = ["commit", "-m", message];
  if (opts.amend) args.splice(1, 0, "--amend");
  try {
    await runGit(root, args);
  } catch (err) {
    if (err instanceof GitCommandError) {
      // `git commit` with nothing staged writes its diagnostic to STDOUT (not stderr) and
      // exits non-zero, so the runner's default "stderr || stdout || exec" message ends up
      // showing the raw output. Detect the common cases and rewrite into something the
      // user-facing toast can render verbatim.
      const haystack = `${err.stdout} ${err.stderr}`.toLowerCase();
      if (
        haystack.includes("nothing to commit") ||
        haystack.includes("nothing added to commit") ||
        haystack.includes("no changes added to commit")
      ) {
        throw new GitCommandError(
          "Nothing to commit — stage some files first.",
          err.exitCode,
          err.stderr,
          err.stdout,
        );
      }
    }
    throw err;
  }
  // Resolve the freshly-written HEAD so the renderer can render "you just committed X".
  const { stdout } = await runGit(root, ["log", "-n1", "--format=%H%x1f%h%x1f%s"]);
  const [sha = "", shortSha = "", subject = ""] = stdout.trim().split("\x1f");
  return { sha, shortSha, subject };
}

export interface PushOptions {
  /** Default false. When true, runs `git push --force-with-lease` — the safer flavor of
   * force push that aborts if the remote has commits the local doesn't know about. */
  forceWithLease?: boolean;
}

export type PushOutcome =
  | { ok: true; stderr: string }
  | { ok: false; reason: PushFailureReason; stderr: string };

export type PushFailureReason =
  | "non_fast_forward"
  | "no_upstream"
  | "auth_failed"
  | "rejected"
  | "unknown";

/**
 * Push the current branch to its upstream. Returns a structured outcome instead of
 * throwing on push-level failures because the renderer needs to discriminate between
 * "non-fast-forward" (offer pull --rebase / force push) and the other failure modes.
 *
 * `GIT_TERMINAL_PROMPT=0` ensures missing-credentials fails fast instead of hanging on a
 * terminal prompt that nothing's reading — `runGit` would still time out, but cleanly
 * bouncing the operation makes the toast actionable.
 */
export async function push(root: string, opts: PushOptions = {}): Promise<PushOutcome> {
  const args = ["push"];
  if (opts.forceWithLease) args.push("--force-with-lease");
  try {
    const { stderr } = await runGit(root, args, {
      timeoutMs: 60_000,
      env: { GIT_TERMINAL_PROMPT: "0" },
    });
    return { ok: true, stderr };
  } catch (err) {
    if (err instanceof GitCommandError) {
      return { ok: false, reason: classifyPushFailure(err.stderr), stderr: err.stderr };
    }
    throw err;
  }
}

function classifyPushFailure(stderr: string): PushFailureReason {
  const s = stderr.toLowerCase();
  if (s.includes("non-fast-forward") || s.includes("fetch first") || s.includes("rejected")) {
    return s.includes("non-fast-forward") || s.includes("fetch first")
      ? "non_fast_forward"
      : "rejected";
  }
  if (s.includes("no upstream") || s.includes("set-upstream") || s.includes("has no upstream")) {
    return "no_upstream";
  }
  if (
    s.includes("authentication") ||
    s.includes("could not read") ||
    s.includes("permission denied")
  ) {
    return "auth_failed";
  }
  return "unknown";
}

export interface PullOptions {
  /** Default true — match the way most teams configure their pull behavior these days. */
  rebase?: boolean;
}

export type PullOutcome =
  | { ok: true; stderr: string }
  | { ok: false; reason: PullFailureReason; stderr: string };

export type PullFailureReason = "conflict" | "no_upstream" | "auth_failed" | "unknown";

export async function pull(root: string, opts: PullOptions = {}): Promise<PullOutcome> {
  const rebase = opts.rebase ?? true;
  const args = ["pull"];
  args.push(rebase ? "--rebase" : "--no-rebase");
  try {
    const { stderr } = await runGit(root, args, {
      timeoutMs: 60_000,
      env: { GIT_TERMINAL_PROMPT: "0" },
    });
    return { ok: true, stderr };
  } catch (err) {
    if (err instanceof GitCommandError) {
      return { ok: false, reason: classifyPullFailure(err.stderr), stderr: err.stderr };
    }
    throw err;
  }
}

function classifyPullFailure(stderr: string): PullFailureReason {
  const s = stderr.toLowerCase();
  if (s.includes("conflict") || s.includes("could not apply")) return "conflict";
  if (s.includes("no tracking") || s.includes("there is no tracking")) return "no_upstream";
  if (s.includes("authentication") || s.includes("permission denied")) return "auth_failed";
  return "unknown";
}

/** Soft reset to HEAD^. Used by the "undo" action on the commit-success notification —
 * the working tree and index are preserved, only the commit object is unwound. */
export async function resetSoftHeadParent(root: string): Promise<void> {
  await runGit(root, ["reset", "--soft", "HEAD^"]);
}

/**
 * Discard working-tree edits to `paths`, restoring each to its HEAD content. For
 * untracked paths (which have no HEAD entry) we fall back to `git clean -f --` so the
 * file is removed — that's the user's intent when they "rollback" an untracked file in
 * the changes list.
 *
 * Splitting the two `git` invocations means a typo in one tracked path doesn't prevent
 * the untracked cleanup from running, and vice versa. The two sets are passed in
 * pre-classified by the caller — the renderer already knows from `GitChange.untracked`.
 */
export async function checkoutPaths(
  root: string,
  paths: { tracked: string[]; untracked: string[] },
): Promise<void> {
  if (paths.tracked.length > 0) {
    await runGit(root, ["checkout", "HEAD", "--", ...paths.tracked]);
  }
  if (paths.untracked.length > 0) {
    await runGit(root, ["clean", "-f", "--", ...paths.untracked]);
  }
}

export interface StashOptions {
  /** Optional message attached to the stash entry. When omitted git auto-generates one. */
  message?: string;
  /** When set, only these paths are stashed (`git stash push -- <paths>`). Empty/omitted
   * means stash everything that's currently dirty. Stashing arbitrary untracked files
   * needs `--include-untracked`, which we set automatically when any untracked path is
   * named so the user doesn't have to know that flag. */
  paths?: string[];
  /** When true, also stash untracked files in the working tree. Use when no `paths` are
   * specified but the user wants a complete snapshot. */
  includeUntracked?: boolean;
}

export type StashOutcome =
  | { ok: true; stderr: string }
  | { ok: false; reason: StashFailureReason; stderr: string };

export type StashFailureReason = "no_changes" | "unknown";

/**
 * Stash the working tree (or just `opts.paths`). Returns a structured outcome so the
 * "nothing to stash" case gets its own friendly notification instead of bouncing as a raw
 * git error.
 */
export async function stash(root: string, opts: StashOptions = {}): Promise<StashOutcome> {
  const args = ["stash", "push"];
  if (opts.includeUntracked || (opts.paths && opts.paths.length > 0)) {
    args.push("--include-untracked");
  }
  if (opts.message) args.push("-m", opts.message);
  if (opts.paths && opts.paths.length > 0) args.push("--", ...opts.paths);
  try {
    const { stderr, stdout } = await runGit(root, args);
    // `git stash push` exits 0 even when there are no changes — it prints
    // "No local changes to save" to stdout. Surface that as a soft failure so the toast
    // doesn't lie about having stashed anything.
    if (/no local changes to save/i.test(stdout) || /no local changes to save/i.test(stderr)) {
      return { ok: false, reason: "no_changes", stderr: stdout || stderr };
    }
    return { ok: true, stderr };
  } catch (err) {
    if (err instanceof GitCommandError) {
      const haystack = `${err.stdout} ${err.stderr}`.toLowerCase();
      if (haystack.includes("no local changes")) {
        return { ok: false, reason: "no_changes", stderr: err.stderr };
      }
      return { ok: false, reason: "unknown", stderr: err.stderr };
    }
    throw err;
  }
}

export type StashPopOutcome =
  | { ok: true; stderr: string }
  | { ok: false; reason: StashPopFailureReason; stderr: string };

export type StashPopFailureReason = "empty_stack" | "conflict" | "unknown";

/**
 * Apply and drop the latest stash entry. `git stash pop` exits non-zero in two distinct
 * scenarios we care about — empty stash list and merge conflicts during apply — so we
 * classify them up front rather than leaking raw git output to the user.
 */
export async function stashPop(root: string): Promise<StashPopOutcome> {
  try {
    const { stderr } = await runGit(root, ["stash", "pop"]);
    return { ok: true, stderr };
  } catch (err) {
    if (err instanceof GitCommandError) {
      const haystack = `${err.stdout} ${err.stderr}`.toLowerCase();
      if (haystack.includes("no stash entries") || haystack.includes("nothing to apply")) {
        return { ok: false, reason: "empty_stack", stderr: err.stderr };
      }
      if (haystack.includes("conflict") || haystack.includes("could not apply")) {
        return { ok: false, reason: "conflict", stderr: err.stderr };
      }
      return { ok: false, reason: "unknown", stderr: err.stderr };
    }
    throw err;
  }
}

/** Re-export so the router can `instanceof`-check without importing from runner.js too. */
export { NotARepoError };
