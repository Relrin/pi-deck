import type { Project, ProjectSummary } from "@pi-deck/core/domain/project.js";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { humanizeError } from "../../lib/format/humanize-error.js";
import type { ProtocolClient } from "../../lib/transport/protocol-client.js";
import { useNotificationStore } from "../_status/useNotificationStore.js";

interface ProjectsStoreState {
  projects: ProjectSummary[];
  activeProjectId: string | undefined;
  /** Per-project memory of the last session the user had active; used on project switch. */
  lastActiveSessionByProject: Record<string, string>;
  loadProjects: (client: ProtocolClient) => Promise<void>;
  openProjectFromDialog: (client: ProtocolClient) => Promise<Project | undefined>;
  openProjectByPath: (client: ProtocolClient, path: string) => Promise<Project | undefined>;
  setActive: (id: string | undefined) => void;
  setLastActiveSession: (projectId: string, sessionId: string | undefined) => void;
  hydrateActive: (client: ProtocolClient) => Promise<void>;
}

export const useProjectsStore = create<ProjectsStoreState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: undefined,
      lastActiveSessionByProject: {},

      loadProjects: async (client) => {
        const { projects } = await client.call("project.list", {});
        set({ projects });
      },

      openProjectFromDialog: async (client) => {
        const path = await window.bridge?.openDirectory?.();
        if (!path) return undefined;
        return get().openProjectByPath(client, path);
      },

      openProjectByPath: async (client, path) => {
        try {
          const { project } = await client.call("project.open", { path });
          await get().loadProjects(client);
          set({ activeProjectId: project.id });
          return project;
        } catch (err) {
          useNotificationStore.getState().error(humanizeError(err, "Failed to open project"));
          return undefined;
        }
      },

      setActive: (id) => set({ activeProjectId: id }),

      setLastActiveSession: (projectId, sessionId) =>
        set((state) => {
          const next = { ...state.lastActiveSessionByProject };
          if (sessionId === undefined) {
            delete next[projectId];
          } else {
            next[projectId] = sessionId;
          }
          return { lastActiveSessionByProject: next };
        }),

      hydrateActive: async (client) => {
        try {
          await get().loadProjects(client);
        } catch (err) {
          useNotificationStore.getState().error(humanizeError(err, "Failed to load projects"));
        }
        const id = get().activeProjectId;
        if (!id) return;
        const found = get().projects.find((p) => p.id === id);
        if (!found) {
          // Persisted project no longer exists on disk — clear it but keep the per-project
          // session memory for any sibling projects.
          set({ activeProjectId: undefined });
          return;
        }
        // Reopen so the host has it fresh as the lastOpened project.
        try {
          await client.call("project.open", { path: found.path });
        } catch {
          // Non-fatal — host metadata still has the project listed.
        }
      },
    }),
    {
      name: "pi-deck:projects:v1",
      // We persist the projects list as a cache so the sidebar paints instantly on reload;
      // `loadProjects` overwrites it from the backend a few hundred ms later, so any stale
      // entries self-heal. `lastActiveSessionByProject` is purely UI state — backend doesn't
      // know about it.
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        lastActiveSessionByProject: state.lastActiveSessionByProject,
      }),
    },
  ),
);
