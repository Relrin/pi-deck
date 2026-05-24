import { GitCommandError, NotARepoError, runGit } from "./runner.js";

export interface PrUrlResult {
  /** Browser URL that opens the "new PR" page for the current branch. */
  url: string;
  /** The branch the URL targets — handy for the notification body. */
  branch: string;
  /** Remote name we resolved against (almost always "origin"). */
  remote: string;
}

/**
 * Resolve the "open a PR for this branch" URL. Supports GitHub, GitLab, Bitbucket via host
 * sniffing; falls back to the bare repository URL when the host is unrecognised so the user
 * can still navigate from there.
 *
 * Errors when:
 *   - no remote is configured (the panel button already disables in that case, but we
 *     defend in depth)
 *   - HEAD is detached (no branch to PR from)
 */
export async function getPrUrl(root: string, remote = "origin"): Promise<PrUrlResult> {
  let urlOut: string;
  try {
    const { stdout } = await runGit(root, ["remote", "get-url", remote]);
    urlOut = stdout.trim();
  } catch (err) {
    if (err instanceof GitCommandError) {
      throw new GitCommandError(`Remote "${remote}" is not configured`, err.exitCode, err.stderr);
    }
    throw err;
  }
  const branch = (await runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
  if (!branch || branch === "HEAD") {
    throw new GitCommandError("HEAD is detached — switch to a branch before opening a PR", 1, "");
  }
  const base = normalizeRemoteUrl(urlOut);
  const url = buildPrUrl(base, branch);
  return { url, branch, remote };
}

/**
 * Turn the wide variety of remote URL shapes git accepts into a canonical
 * `https://<host>/<path>` form. Handles:
 *   - `https://host/owner/repo.git`
 *   - `https://user@host/owner/repo.git`
 *   - `git@host:owner/repo.git`
 *   - `ssh://git@host/owner/repo.git`
 */
export function normalizeRemoteUrl(remoteUrl: string): { host: string; path: string; raw: string } {
  let raw = remoteUrl.trim();
  if (raw.endsWith(".git")) raw = raw.slice(0, -4);

  // SCP-style: `git@host:owner/repo`
  const scp = /^([^@\s]+)@([^:]+):(.+)$/.exec(raw);
  if (scp) {
    const host = scp[2] ?? "";
    const path = (scp[3] ?? "").replace(/^\/+/, "");
    return { host, path, raw };
  }

  // URL-style — strip the optional `user@` userinfo before the host.
  try {
    const u = new URL(raw);
    return {
      host: u.hostname,
      path: u.pathname.replace(/^\/+/, ""),
      raw,
    };
  } catch {
    return { host: "", path: "", raw };
  }
}

/**
 * Resolve the "view this commit on the host" URL. Mirrors `getPrUrl` — uses the same
 * normalize helper so SCP-style and https URLs both work. Falls back to the bare
 * repository URL when the host isn't recognised.
 */
export async function getCommitUrl(
  root: string,
  sha: string,
  remote = "origin",
): Promise<{ url: string }> {
  const { stdout } = await runGit(root, ["remote", "get-url", remote]);
  const base = normalizeRemoteUrl(stdout.trim());
  if (!base.host || !base.path) return { url: base.raw };
  return { url: `https://${base.host}/${base.path}/commit/${encodeURIComponent(sha)}` };
}

/** Exposed for unit tests; in production callers go through `getPrUrl`. */
export function buildPrUrl(
  base: { host: string; path: string; raw: string },
  branch: string,
): string {
  if (!base.host || !base.path) {
    return base.raw; // Best effort: open the bare URL so the user at least lands somewhere.
  }
  const encoded = encodeURIComponent(branch);
  if (base.host.includes("github.com")) {
    return `https://${base.host}/${base.path}/compare/${encoded}?expand=1`;
  }
  if (base.host.includes("gitlab")) {
    return `https://${base.host}/${base.path}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encoded}`;
  }
  if (base.host.includes("bitbucket")) {
    return `https://${base.host}/${base.path}/pull-requests/new?source=${encoded}`;
  }
  return `https://${base.host}/${base.path}`;
}

export { NotARepoError };
