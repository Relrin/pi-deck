import type { Project, ProjectSummary } from "@pi-deck/core/domain/project.js";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProtocolClient } from "../../lib/transport/protocol-client.js";
import { useToastStore } from "../_status/useToastStore.js";

interface ProjectsStoreState {
  projects: ProjectSummary[];
  activeProjectId: string | undefined;
  loadProjects: (client: ProtocolClient) => Promise<void>;
  openProjectFromDialog: (client: ProtocolClient) => Promise<Project | undefined>;
  openProjectByPath: (client: ProtocolClient, path: string) => Promise<Project | undefined>;
  setActive: (id: string | undefined) => void;
  hydrateActive: (client: ProtocolClient) => Promise<void>;
}

export const useProjectsStore = create<ProjectsStoreState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: undefined,

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
          useToastStore
            .getState()
            .push(err instanceof Error ? err.message : "Failed to open project", "error");
          return undefined;
        }
      },

      setActive: (id) => set({ activeProjectId: id }),

      hydrateActive: async (client) => {
        await get().loadProjects(client);
        const id = get().activeProjectId;
        if (!id) return;
        const found = get().projects.find((p) => p.id === id);
        if (!found) {
          set({ activeProjectId: undefined });
          return;
        }
        // Reopen so the host has it fresh as the lastOpened project.
        try {
          await client.call("project.open", { path: found.path });
        } catch {
          // Ignore — already in metadata.
        }
      },
    }),
    {
      name: "pi-deck:projects:v1",
      partialize: (state) => ({ activeProjectId: state.activeProjectId }),
    },
  ),
);
