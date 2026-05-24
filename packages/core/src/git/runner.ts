import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export class GitNotFoundError extends Error {
  readonly code = "git_not_found" as const;
  constructor() {
    super("git executable not found on PATH");
    this.name = "GitNotFoundError";
  }
}

export class NotARepoError extends Error {
  readonly code = "not_a_repo" as const;
  constructor(message = "Project path is not a git repository") {
    super(message);
    this.name = "NotARepoError";
  }
}

export class GitCommandError extends Error {
  readonly code = "git_failed" as const;
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly stderr: string,
    /** git prints "nothing to commit, working tree clean" to STDOUT, not stderr — we keep
     * stdout around so callers (writes.ts) can detect those soft-failure cases and rewrite
     * the message into something user-facing. */
    public readonly stdout: string = "",
  ) {
    super(message);
    this.name = "GitCommandError";
  }
}

export type AnyGitError = GitNotFoundError | NotARepoError | GitCommandError;

export interface RunGitOptions {
  /** Default 10000ms; child is killed on overrun. */
  timeoutMs?: number;
  /** Default 8 MiB. */
  maxBuffer?: number;
  /** When true (default), match "not a git repository" stderr and throw NotARepoError. */
  detectNotARepo?: boolean;
  /** Extra env merged on top of process.env. */
  env?: NodeJS.ProcessEnv;
}

export interface RunGitResult {
  stdout: string;
  stderr: string;
  code: number;
}

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_MAX_BUFFER = 8 * 1024 * 1024;

/**
 * Thin wrapper around `execFile("git", ...)`. Successful runs resolve to `{stdout, stderr, code: 0}`.
 * Non-zero exits or spawn failures throw a typed error:
 *  - `GitNotFoundError` when `git` isn't on PATH (ENOENT)
 *  - `NotARepoError` when stderr matches the canonical "not a git repository" string
 *  - `GitCommandError` for everything else
 *
 * `core.fsmonitor` and any global hooks are explicitly disabled so behavior is uniform across
 * developer machines.
 */
export async function runGit(
  cwd: string,
  args: string[],
  opts: RunGitOptions = {},
): Promise<RunGitResult> {
  // -c flags applied before the subcommand silence fsmonitor noise and force UTF-8 paths so
  // porcelain output is parseable without unquoting tricks.
  const stableArgs = [
    "-c",
    "core.fsmonitor=false",
    "-c",
    "core.quotepath=false",
    "-c",
    "color.ui=never",
    ...args,
  ];
  try {
    const { stdout, stderr } = await exec("git", stableArgs, {
      cwd,
      timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT,
      maxBuffer: opts.maxBuffer ?? DEFAULT_MAX_BUFFER,
      env: opts.env ? { ...process.env, ...opts.env } : process.env,
      windowsHide: true,
    });
    return { stdout, stderr, code: 0 };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & {
      stderr?: string | Buffer;
      stdout?: string | Buffer;
      code?: number | string;
    };
    if (e.code === "ENOENT") throw new GitNotFoundError();
    const stderr = (e.stderr ?? "").toString().trim();
    const stdout = (e.stdout ?? "").toString().trim();
    if ((opts.detectNotARepo ?? true) && /not a git repository/i.test(stderr)) {
      throw new NotARepoError(stderr || "Project path is not a git repository");
    }
    const exitCode = typeof e.code === "number" ? e.code : 1;
    // Prefer stderr → stdout (e.g. "nothing to commit") → Node exec preamble. Node's
    // default "Command failed: git -c ..." string is verbose and command-line-leaking, so
    // we only fall back to it when git itself produced no output we can surface.
    throw new GitCommandError(stderr || stdout || e.message, exitCode, stderr, stdout);
  }
}
