import type { GitCommit, GitStatus } from "@pi-deck/core/git/types.js";
import { create } from "zustand";
import { humanizeError } from "../../lib/format/humanize-error.js";
import { useToastStore } from "../_status/useToastStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";

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
  /** In-flight flags for status/log; UI uses these to swap spinners for content. */
  statusLoadingByProject: Record<string, boolean>;
  commitsLoadingByProject: Record<string, boolean>;
  /** Per-session set of file paths the agent has touched. Drives the touch-dot badge. */
  touchesBySession: Record<string, string[] | undefined>;

  refresh: (projectId: string) => Promise<void>;
  checkout: (projectId: string, name: string) => Promise<void>;
  createBranch: (projectId: string, name: string) => Promise<void>;

  ensureStatus: (projectId: string) => Promise<void>;
  refreshStatus: (projectId: string) => Promise<void>;
  refreshCommits: (projectId: string, limit?: number) => Promise<void>;
  applyStatusChanged: (projectId: string, status: GitStatus) => void;
  applyTurnTouches: (sessionId: string, paths: string[]) => void;
  initRepo: (projectId: string) => Promise<void>;
}

const inflight = new Map<string, Promise<void>>();
const statusInflight = new Map<string, Promise<void>>();

export const useGitStore = create<GitStoreState>((set, get) => ({
  branchesByProject: {},
  currentBranchByProject: {},
  loadingByProject: {},
  errorByProject: {},

  statusByProject: {},
  commitsByProject: {},
  statusLoadingByProject: {},
  commitsLoadingByProject: {},
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

  applyStatusChanged: (projectId, status) => {
    set((state) => ({
      statusByProject: { ...state.statusByProject, [projectId]: status },
    }));
    // A status change can mean a branch switch or a new commit — refresh the dependent
    // pieces so the header + commits list reflect the new HEAD.
    void get().refresh(projectId);
    void get().refreshCommits(projectId);
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
}));
