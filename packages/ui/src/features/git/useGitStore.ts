import type { GitCommit, GitHunk, GitStatus } from "@pi-deck/core/git/types.js";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { createElement } from "react";
import { create } from "zustand";
import { humanizeError } from "../../lib/format/humanize-error.js";
import { useNotificationStore } from "../_status/useNotificationStore.js";
import { useToastStore } from "../_status/useToastStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import {
  commitFailureNotification,
  commitSuccessNotification,
  pullFailureNotification,
  pullSuccessNotification,
  pushFailureNotification,
  pushSuccessNotification,
  refreshSuccessNotification,
  rollbackFailureNotification,
  rollbackSuccessNotification,
  stashFailureNotification,
  stashPopFailureNotification,
  stashPopSuccessNotification,
  stashSuccessNotification,
} from "./git-notify.js";
import { useStagingStore } from "./useStagingStore.js";

export interface GitBranchInfo {
  name: string;
  isCurrent: boolean;
  lastActivityAt?: string;
}

interface GitStoreState {
  branchesByProject: Record<string, GitBranchInfo[]>;
  currentBranchByProject: Record<string, string>;
  loadingByProject: Record<string, boolean>;
  errorByProject: Record<string, string | undefined>;

  /** Cached `git.status` per project. Replaced wholesale on each refresh / change event. */
  statusByProject: Record<string, GitStatus | undefined>;
  /** Cached `git.log` per project, newest first. */
  commitsByProject: Record<string, GitCommit[] | undefined>;
  /** Cached `git.diffHunks` per project. Lazy — populated only when the changes list is
   * switched to "hunk" grouping. Missing-path entries are treated as "no hunks". */
  hunksByProject: Record<string, Record<string, GitHunk[]> | undefined>;
  /** In-flight flags for status/log; UI uses these to swap spinners for content. */
  statusLoadingByProject: Record<string, boolean>;
  commitsLoadingByProject: Record<string, boolean>;
  hunksLoadingByProject: Record<string, boolean>;
  /** Per-session set of file paths the agent has touched. Drives the touch-dot badge. */
  touchesBySession: Record<string, string[] | undefined>;

  refresh: (projectId: string) => Promise<void>;
  checkout: (projectId: string, name: string) => Promise<void>;
  createBranch: (projectId: string, name: string) => Promise<void>;

  ensureStatus: (projectId: string) => Promise<void>;
  refreshStatus: (projectId: string) => Promise<void>;
  refreshCommits: (projectId: string, limit?: number) => Promise<void>;
  refreshHunks: (projectId: string) => Promise<void>;
  applyStatusChanged: (projectId: string, status: GitStatus) => void;
  applyTurnTouches: (sessionId: string, paths: string[]) => void;
  initRepo: (projectId: string) => Promise<void>;

  /** Stage `paths` (if provided) and commit with `message`. Pushes a success or failure
   * notification; the success variant carries view/undo/push actions. */
  commit: (
    projectId: string,
    opts: { message: string; amend?: boolean; paths?: string[] },
  ) => Promise<{ sha: string; shortSha: string; subject: string } | undefined>;
  push: (projectId: string, opts?: { forceWithLease?: boolean }) => Promise<boolean>;
  pull: (projectId: string, opts?: { rebase?: boolean }) => Promise<boolean>;
  openPr: (projectId: string) => Promise<void>;
  undoLastCommit: (projectId: string) => Promise<void>;
  viewCommitOnRemote: (projectId: string, sha: string) => Promise<void>;
  /** Re-read git state from disk (status, branches, commits, and hunks if loaded). Used
   * by the changes-toolbar refresh button when the user has run git commands externally. */
  refreshAll: (projectId: string) => Promise<void>;
  /** Restore the selected paths to HEAD via `git checkout` (or remove via `git clean` for
   * untracked entries). Caller passes the already-classified path sets. */
  rollback: (
    projectId: string,
    paths: { tracked: string[]; untracked: string[] },
  ) => Promise<boolean>;
  /** Stash the listed paths (empty/omitted = whole working tree). */
  stash: (projectId: string, paths?: string[]) => Promise<boolean>;
  /** Apply and drop the latest stash entry. */
  stashPop: (projectId: string) => Promise<boolean>;
}

const inflight = new Map<string, Promise<void>>();
const statusInflight = new Map<string, Promise<void>>();
const hunksInflight = new Map<string, Promise<void>>();

export const useGitStore = create<GitStoreState>((set, get) => ({
  branchesByProject: {},
  currentBranchByProject: {},
  loadingByProject: {},
  errorByProject: {},

  statusByProject: {},
  commitsByProject: {},
  hunksByProject: {},
  statusLoadingByProject: {},
  commitsLoadingByProject: {},
  hunksLoadingByProject: {},
  touchesBySession: {},

  refresh: async (projectId) => {
    const existing = inflight.get(projectId);
    if (existing) return existing;
    const client = useSessionsStore.getState().client;
    if (!client) return;
    const run = (async () => {
      set((state) => ({
        loadingByProject: { ...state.loadingByProject, [projectId]: true },
      }));
      try {
        const [{ branches }, { name }] = await Promise.all([
          client.call("git.listBranches", { projectId }),
          client.call("git.currentBranch", { projectId }),
        ]);
        set((state) => ({
          branchesByProject: { ...state.branchesByProject, [projectId]: branches },
          currentBranchByProject: { ...state.currentBranchByProject, [projectId]: name },
          errorByProject: { ...state.errorByProject, [projectId]: undefined },
        }));
      } catch (err) {
        const message = humanizeError(err, "Failed to load branches");
        set((state) => ({
          errorByProject: { ...state.errorByProject, [projectId]: message },
        }));
      } finally {
        set((state) => ({
          loadingByProject: { ...state.loadingByProject, [projectId]: false },
        }));
        inflight.delete(projectId);
      }
    })();
    inflight.set(projectId, run);
    return run;
  },

  checkout: async (projectId, name) => {
    const client = useSessionsStore.getState().client;
    if (!client) return;
    try {
      await client.call("git.checkoutBranch", { projectId, name });
      set((state) => ({
        currentBranchByProject: { ...state.currentBranchByProject, [projectId]: name },
        branchesByProject: {
          ...state.branchesByProject,
          [projectId]: (state.branchesByProject[projectId] ?? []).map((b) => ({
            ...b,
            isCurrent: b.name === name,
          })),
        },
      }));
      void get().refresh(projectId);
      void get().refreshStatus(projectId);
    } catch (err) {
      useToastStore.getState().push(humanizeError(err, "Failed to checkout branch"), "error");
      throw err;
    }
  },

  createBranch: async (projectId, name) => {
    const client = useSessionsStore.getState().client;
    if (!client) return;
    try {
      await client.call("git.createBranch", { projectId, name });
      // git checkout -b makes the new branch HEAD — update local state optimistically
      // and refresh to pick up the canonical branch list (including lastActivityAt).
      set((state) => ({
        currentBranchByProject: { ...state.currentBranchByProject, [projectId]: name },
      }));
      void get().refresh(projectId);
    } catch (err) {
      useToastStore.getState().push(humanizeError(err, "Failed to create branch"), "error");
      throw err;
    }
  },

  ensureStatus: async (projectId) => {
    const state = get();
    if (state.statusByProject[projectId] !== undefined) return;
    if (state.statusLoadingByProject[projectId]) return;
    await get().refreshStatus(projectId);
  },

  refreshStatus: async (projectId) => {
    const existing = statusInflight.get(projectId);
    if (existing) return existing;
    const client = useSessionsStore.getState().client;
    if (!client) return;
    const run = (async () => {
      set((state) => ({
        statusLoadingByProject: { ...state.statusLoadingByProject, [projectId]: true },
      }));
      try {
        const { status } = await client.call("git.status", { projectId });
        set((state) => ({
          statusByProject: { ...state.statusByProject, [projectId]: status },
        }));
        // Trigger commits load lazily — the panel will subscribe and render when present.
        if (status.isRepo && !get().commitsByProject[projectId]) {
          void get().refreshCommits(projectId);
        }
      } catch (err) {
        const message = humanizeError(err, "Failed to read git status");
        set((state) => ({
          errorByProject: { ...state.errorByProject, [projectId]: message },
        }));
      } finally {
        set((state) => ({
          statusLoadingByProject: { ...state.statusLoadingByProject, [projectId]: false },
        }));
        statusInflight.delete(projectId);
      }
    })();
    statusInflight.set(projectId, run);
    return run;
  },

  refreshCommits: async (projectId, limit = 20) => {
    const client = useSessionsStore.getState().client;
    if (!client) return;
    set((state) => ({
      commitsLoadingByProject: { ...state.commitsLoadingByProject, [projectId]: true },
    }));
    try {
      const { commits } = await client.call("git.log", { projectId, limit });
      set((state) => ({
        commitsByProject: { ...state.commitsByProject, [projectId]: commits },
      }));
    } catch {
      // Non-fatal — leave the previous value (or undefined) in place.
    } finally {
      set((state) => ({
        commitsLoadingByProject: { ...state.commitsLoadingByProject, [projectId]: false },
      }));
    }
  },

  refreshHunks: async (projectId) => {
    const existing = hunksInflight.get(projectId);
    if (existing) return existing;
    const client = useSessionsStore.getState().client;
    if (!client) return;
    const run = (async () => {
      set((state) => ({
        hunksLoadingByProject: { ...state.hunksLoadingByProject, [projectId]: true },
      }));
      try {
        const { hunksByPath } = await client.call("git.diffHunks", { projectId });
        set((state) => ({
          hunksByProject: { ...state.hunksByProject, [projectId]: hunksByPath },
        }));
      } catch {
        // Non-fatal — the renderer falls back to "no hunks" rows.
      } finally {
        set((state) => ({
          hunksLoadingByProject: { ...state.hunksLoadingByProject, [projectId]: false },
        }));
        hunksInflight.delete(projectId);
      }
    })();
    hunksInflight.set(projectId, run);
    return run;
  },

  applyStatusChanged: (projectId, status) => {
    const hadHunks = Boolean(get().hunksByProject[projectId]);
    set((state) => ({
      statusByProject: { ...state.statusByProject, [projectId]: status },
    }));
    // A status change can mean a branch switch or a new commit — refresh the dependent
    // pieces so the header + commits list reflect the new HEAD.
    void get().refresh(projectId);
    void get().refreshCommits(projectId);
    // Refresh hunks in place when the user already had them loaded. We deliberately do NOT
    // drop the cache first: clearing it would briefly show the file rows without children
    // before the new fetch lands, which reads as a "flicker" every time the watcher fires.
    // Leaving the old entry visible until `refreshHunks` atomically replaces it gives the
    // sidebar a stable feel while still keeping the line ranges accurate.
    if (hadHunks) void get().refreshHunks(projectId);
  },

  applyTurnTouches: (sessionId, paths) => {
    set((state) => ({
      touchesBySession: { ...state.touchesBySession, [sessionId]: paths },
    }));
  },

  initRepo: async (projectId) => {
    const client = useSessionsStore.getState().client;
    if (!client) return;
    try {
      await client.call("git.init", { projectId });
      await Promise.all([get().refreshStatus(projectId), get().refresh(projectId)]);
    } catch (err) {
      useToastStore.getState().push(humanizeError(err, "Failed to initialise repository"), "error");
    }
  },

  commit: async (projectId, opts) => {
    const client = useSessionsStore.getState().client;
    if (!client) return;
    const notify = useNotificationStore.getState();
    const statusBefore = get().statusByProject[projectId];
    const branch = statusBefore?.branch;
    // Sum the +/- across the files we're about to commit so the success card can show
    // "+212 -18" without needing to wait for the post-commit numstat refresh.
    const paths = opts.paths;
    const involved = statusBefore?.changes.filter((c) => !paths || paths.includes(c.path)) ?? [];
    const totals = involved.reduce((acc, c) => ({ add: acc.add + c.add, del: acc.del + c.del }), {
      add: 0,
      del: 0,
    });
    try {
      const result = await client.call("git.commit", {
        projectId,
        message: opts.message,
        amend: opts.amend,
        paths: opts.paths,
      });
      notify.push(
        commitSuccessNotification(projectId, {
          branch,
          shortSha: result.shortSha,
          subject: result.subject,
          fileCount: involved.length,
          add: totals.add,
          del: totals.del,
          actions: [
            {
              id: "view",
              label: "view",
              variant: "secondary",
              onSelect: () => void get().viewCommitOnRemote(projectId, result.sha),
            },
            {
              id: "undo",
              label: "undo",
              variant: "secondary",
              onSelect: () => void get().undoLastCommit(projectId),
            },
            {
              id: "push",
              label: "push",
              variant: "primary",
              leadingIcon: createElement(ArrowUpFromLine, { size: 11 }),
              onSelect: () => void get().push(projectId),
            },
          ],
        }),
      );
      // Status refresh runs eagerly so the changes list empties immediately after commit.
      void get().refreshStatus(projectId);
      return result;
    } catch (err) {
      notify.push(commitFailureNotification(projectId, humanizeError(err, "Commit failed")));
      return undefined;
    }
  },

  push: async (projectId, opts = {}) => {
    const client = useSessionsStore.getState().client;
    if (!client) return false;
    const notify = useNotificationStore.getState();
    const status = get().statusByProject[projectId];
    const branch = status?.branch ?? "HEAD";
    const remote = status?.remotes[0] ?? "origin";
    try {
      const outcome = await client.call("git.push", {
        projectId,
        forceWithLease: opts.forceWithLease,
      });
      if (outcome.ok) {
        notify.push(
          pushSuccessNotification(projectId, {
            remote,
            branch,
            ahead: status?.ahead ?? 0,
          }),
        );
        void get().refreshStatus(projectId);
        return true;
      }
      notify.push(
        pushFailureNotification(projectId, {
          remote,
          branch,
          reason: outcome.reason,
          stderr: outcome.stderr,
          actions: buildPushFailureActions(projectId, outcome.reason, get),
        }),
      );
      return false;
    } catch (err) {
      notify.push(
        pushFailureNotification(projectId, {
          remote,
          branch,
          reason: "unknown",
          stderr: humanizeError(err, ""),
          actions: [],
        }),
      );
      return false;
    }
  },

  pull: async (projectId, opts = {}) => {
    const client = useSessionsStore.getState().client;
    if (!client) return false;
    const notify = useNotificationStore.getState();
    const status = get().statusByProject[projectId];
    const branch = status?.branch ?? "HEAD";
    const remote = status?.remotes[0] ?? "origin";
    const rebase = opts.rebase ?? true;
    try {
      const outcome = await client.call("git.pull", { projectId, rebase });
      if (outcome.ok) {
        notify.push(pullSuccessNotification(projectId, { remote, branch, rebased: rebase }));
        void get().refreshStatus(projectId);
        return true;
      }
      notify.push(
        pullFailureNotification(projectId, {
          remote,
          branch,
          reason: outcome.reason,
          stderr: outcome.stderr,
        }),
      );
      return false;
    } catch (err) {
      notify.push(
        pullFailureNotification(projectId, {
          remote,
          branch,
          reason: "unknown",
          stderr: humanizeError(err, ""),
        }),
      );
      return false;
    }
  },

  openPr: async (projectId) => {
    const client = useSessionsStore.getState().client;
    if (!client) return;
    try {
      const { url } = await client.call("git.openPrUrl", { projectId });
      // `window.open` is routed by the Electron main process to `shell.openExternal` for
      // http(s) URLs via setWindowOpenHandler — see packages/desktop/src/main/window.ts.
      window.open(url, "_blank", "noopener");
    } catch (err) {
      useToastStore.getState().push(humanizeError(err, "Failed to open PR URL"), "error");
    }
  },

  undoLastCommit: async (projectId) => {
    const client = useSessionsStore.getState().client;
    if (!client) return;
    try {
      await client.call("git.resetSoftHeadParent", { projectId });
      void get().refreshStatus(projectId);
      void get().refreshCommits(projectId);
    } catch (err) {
      useToastStore.getState().push(humanizeError(err, "Undo failed"), "error");
    }
  },

  viewCommitOnRemote: async (projectId, sha) => {
    const client = useSessionsStore.getState().client;
    if (!client) return;
    try {
      const { url } = await client.call("git.commitUrl", { projectId, sha });
      window.open(url, "_blank", "noopener");
    } catch (err) {
      useToastStore.getState().push(humanizeError(err, "Failed to resolve commit URL"), "error");
    }
  },

  refreshAll: async (projectId) => {
    const client = useSessionsStore.getState().client;
    if (!client) return;
    await Promise.all([get().refreshStatus(projectId), get().refresh(projectId)]);
    void get().refreshCommits(projectId);
    // Refresh hunks too when the user is currently viewing the hunk grouping — otherwise
    // they'd see stale line ranges until the next external watcher event.
    if (get().hunksByProject[projectId]) void get().refreshHunks(projectId);
    useNotificationStore.getState().push(refreshSuccessNotification(projectId));
  },

  rollback: async (projectId, paths) => {
    const client = useSessionsStore.getState().client;
    if (!client) return false;
    const notify = useNotificationStore.getState();
    const total = paths.tracked.length + paths.untracked.length;
    if (total === 0) {
      notify.push(rollbackFailureNotification(projectId, "No files selected."));
      return false;
    }
    try {
      await client.call("git.checkoutPaths", { projectId, ...paths });
      // Clear the staging selection so the now-rolled-back files don't linger as "checked"
      // entries pointing at paths that may no longer exist.
      useStagingStore.getState().resetProject(projectId);
      void get().refreshStatus(projectId);
      notify.push(rollbackSuccessNotification(projectId, { fileCount: total }));
      return true;
    } catch (err) {
      notify.push(rollbackFailureNotification(projectId, humanizeError(err, "Rollback failed")));
      return false;
    }
  },

  stash: async (projectId, paths) => {
    const client = useSessionsStore.getState().client;
    if (!client) return false;
    const notify = useNotificationStore.getState();
    try {
      const outcome = await client.call("git.stash", {
        projectId,
        paths,
        // No explicit paths = "snapshot the whole working tree" — include untracked too so
        // a stash actually saves the user's net dirty state, not just tracked edits.
        includeUntracked: !paths || paths.length === 0,
      });
      if (!outcome.ok) {
        notify.push(stashFailureNotification(projectId, outcome.reason, outcome.stderr));
        return false;
      }
      useStagingStore.getState().resetProject(projectId);
      void get().refreshStatus(projectId);
      const popAction = {
        id: "pop",
        label: "apply",
        variant: "secondary" as const,
        onSelect: () => void get().stashPop(projectId),
      };
      notify.push(stashSuccessNotification(projectId, { selectedCount: paths?.length }, popAction));
      return true;
    } catch (err) {
      notify.push(stashFailureNotification(projectId, "unknown", humanizeError(err, "")));
      return false;
    }
  },

  stashPop: async (projectId) => {
    const client = useSessionsStore.getState().client;
    if (!client) return false;
    const notify = useNotificationStore.getState();
    try {
      const outcome = await client.call("git.stashPop", { projectId });
      if (!outcome.ok) {
        notify.push(stashPopFailureNotification(projectId, outcome.reason, outcome.stderr));
        return false;
      }
      void get().refreshStatus(projectId);
      notify.push(stashPopSuccessNotification(projectId));
      return true;
    } catch (err) {
      notify.push(stashPopFailureNotification(projectId, "unknown", humanizeError(err, "")));
      return false;
    }
  },
}));

/**
 * Compose the action buttons shown on a push-failure notification. Only the
 * non-fast-forward case offers both "pull --rebase" and "force push"; the other failure
 * modes either don't have a sensible retry (auth) or need a one-time setup step
 * (no upstream) that we don't try to fix in-band.
 */
function buildPushFailureActions(
  projectId: string,
  reason: "non_fast_forward" | "no_upstream" | "auth_failed" | "rejected" | "unknown",
  get: () => GitStoreState,
) {
  if (reason !== "non_fast_forward") return [];
  return [
    {
      id: "pull-rebase",
      label: "pull --rebase",
      variant: "secondary" as const,
      leadingIcon: createElement(ArrowDownToLine, { size: 11 }),
      dismissAfter: false,
      onSelect: () => void get().pull(projectId, { rebase: true }),
    },
    {
      id: "force-push",
      label: "force push",
      variant: "danger" as const,
      leadingIcon: createElement(ArrowUpFromLine, { size: 11 }),
      dismissAfter: false,
      onSelect: () => void get().push(projectId, { forceWithLease: true }),
    },
  ];
}
