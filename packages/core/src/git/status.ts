import { GitCommandError, NotARepoError, runGit } from "./runner.js";
import type { GitChange, GitChangeStatus, GitStatus } from "./types.js";

/**
 * Fetches the working-tree status for `root` plus per-file +/- counts vs HEAD. Single
 * `git status --porcelain=v2 --branch --untracked-files=all` call gives the structure;
 * a parallel `git diff HEAD --numstat` gives line counts. Both calls fail fast on a non-repo
 * via `runner.ts` and resolve to `{ isRepo: false, ... }` for the caller.
 */
export async function getStatus(root: string): Promise<GitStatus> {
  try {
    const statusResult = await runGit(root, [
      "status",
      "--porcelain=v2",
      "--branch",
      "--untracked-files=all",
      "--renames",
    ]);

    const numstats = await readNumstat(root);
    const changes = parseStatus(statusResult.stdout);
    for (const change of changes) {
      const entry = numstats.get(change.path);
      if (entry) {
        change.add = entry.add;
        change.del = entry.del;
      }
    }
    const branchInfo = parseBranchHeaders(statusResult.stdout);
    const totals = changes.reduce((acc, c) => ({ add: acc.add + c.add, del: acc.del + c.del }), {
      add: 0,
      del: 0,
    });

    return {
      isRepo: true,
      root,
      ...branchInfo,
      changes,
      totals,
    };
  } catch (err) {
    if (err instanceof NotARepoError) {
      return {
        isRepo: false,
        changes: [],
        totals: { add: 0, del: 0 },
      };
    }
    throw err;
  }
}

async function readNumstat(root: string): Promise<Map<string, { add: number; del: number }>> {
  try {
    const { stdout } = await runGit(root, ["diff", "HEAD", "--numstat", "--no-renames"]);
    return parseNumstat(stdout);
  } catch (err) {
    if (err instanceof GitCommandError) {
      // `git diff HEAD` fails before the initial commit. Fall back to the index-vs-empty-tree
      // diff so newly-added-but-not-yet-committed files still show line counts.
      try {
        const { stdout } = await runGit(root, ["diff", "--cached", "--numstat", "--no-renames"]);
        return parseNumstat(stdout);
      } catch {
        return new Map();
      }
    }
    throw err;
  }
}

interface BranchHeaders {
  branch?: string;
  detached?: boolean;
  upstream?: string;
  ahead?: number;
  behind?: number;
}

function parseBranchHeaders(stdout: string): BranchHeaders {
  const out: BranchHeaders = {};
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith("# branch.")) continue;
    if (line.startsWith("# branch.head ")) {
      const value = line.slice("# branch.head ".length).trim();
      if (value === "(detached)") {
        out.detached = true;
      } else {
        out.branch = value;
      }
    } else if (line.startsWith("# branch.upstream ")) {
      out.upstream = line.slice("# branch.upstream ".length).trim();
    } else if (line.startsWith("# branch.ab ")) {
      const m = line.match(/^# branch\.ab \+(\d+) -(\d+)/);
      if (m) {
        out.ahead = Number(m[1]);
        out.behind = Number(m[2]);
      }
    }
  }
  return out;
}

const VALID_STATUSES = new Set<GitChangeStatus>(["M", "A", "D", "R", "C", "U", "?"]);

function pickStatus(x: string, y: string): GitChangeStatus {
  // Prefer the staged half (X) — that's "what will be committed". Type-change (`T`)
  // collapses to "modified" since the UI's flat list doesn't have a dedicated glyph.
  const candidate = x !== "." ? x : y;
  if (candidate === "T") return "M";
  return VALID_STATUSES.has(candidate as GitChangeStatus) ? (candidate as GitChangeStatus) : "M";
}

/**
 * Split `line` into the first `n` space-separated tokens plus a final remainder. The path is
 * always the last field in porcelain v2 records but may contain spaces, so we never split it.
 */
function splitFirst(line: string, n: number): string[] {
  const parts: string[] = [];
  let rest = line;
  for (let i = 0; i < n; i++) {
    const idx = rest.indexOf(" ");
    if (idx < 0) {
      parts.push(rest);
      return parts;
    }
    parts.push(rest.slice(0, idx));
    rest = rest.slice(idx + 1);
  }
  parts.push(rest);
  return parts;
}

function parseStatus(stdout: string): GitChange[] {
  const out: GitChange[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line) continue;
    const tag = line[0];
    if (tag === "1") {
      // 1 XY sub mH mI mW hH hI <path>
      const parts = splitFirst(line, 8);
      const xy = parts[1] ?? "..";
      const path = parts[8] ?? "";
      if (!path) continue;
      out.push({
        path,
        status: pickStatus(xy[0] ?? ".", xy[1] ?? "."),
        staged: (xy[0] ?? ".") !== ".",
        untracked: false,
        add: 0,
        del: 0,
      });
    } else if (tag === "2") {
      // 2 XY sub mH mI mW hH hI <X><score> <path>\t<origPath>
      const parts = splitFirst(line, 9);
      const xy = parts[1] ?? "..";
      const tail = parts[9] ?? "";
      const tabIdx = tail.indexOf("\t");
      const path = tabIdx >= 0 ? tail.slice(0, tabIdx) : tail;
      const oldPath = tabIdx >= 0 ? tail.slice(tabIdx + 1) : undefined;
      if (!path) continue;
      out.push({
        path,
        status: pickStatus(xy[0] ?? ".", xy[1] ?? "."),
        staged: (xy[0] ?? ".") !== ".",
        untracked: false,
        oldPath,
        add: 0,
        del: 0,
      });
    } else if (tag === "u") {
      // u XY sub m1 m2 m3 mW h1 h2 h3 <path>
      const parts = splitFirst(line, 10);
      const path = parts[10] ?? "";
      if (!path) continue;
      out.push({
        path,
        status: "U",
        staged: false,
        untracked: false,
        add: 0,
        del: 0,
      });
    } else if (tag === "?") {
      const path = line.slice(2);
      if (!path) continue;
      out.push({
        path,
        status: "?",
        staged: false,
        untracked: true,
        add: 0,
        del: 0,
      });
    }
    // tag === "!" (ignored) is dropped — we don't pass --ignored.
  }
  return out;
}

function parseNumstat(stdout: string): Map<string, { add: number; del: number }> {
  const out = new Map<string, { add: number; del: number }>();
  for (const line of stdout.split(/\r?\n/)) {
    if (!line) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const [a, d, path] = parts;
    const addN = a === "-" ? 0 : Number(a);
    const delN = d === "-" ? 0 : Number(d);
    if (path) {
      out.set(path, {
        add: Number.isFinite(addN) ? addN : 0,
        del: Number.isFinite(delN) ? delN : 0,
      });
    }
  }
  return out;
}
