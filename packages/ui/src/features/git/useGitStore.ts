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

  refresh: (projectId: string) => Promise<void>;
  checkout: (projectId: string, name: string) => Promise<void>;
  createBranch: (projectId: string, name: string) => Promise<void>;
}

const inflight = new Map<string, Promise<void>>();

export const useGitStore = create<GitStoreState>((set, get) => ({
  branchesByProject: {},
  currentBranchByProject: {},
  loadingByProject: {},
  errorByProject: {},

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
}));
