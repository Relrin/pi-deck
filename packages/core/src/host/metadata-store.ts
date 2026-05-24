import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  type Project,
  ProjectSchema,
  type ProjectSummary,
  type SessionMetadata,
} from "../domain/project.js";

export class MetadataStore {
  private readonly projectsDir: string;

  constructor(userDataDir: string) {
    this.projectsDir = join(userDataDir, "projects");
  }

  async ensure(): Promise<void> {
    await mkdir(this.projectsDir, { recursive: true });
  }

  async listProjects(): Promise<ProjectSummary[]> {
    await this.ensure();
    let ids: string[];
    try {
      ids = await readdir(this.projectsDir);
    } catch {
      return [];
    }
    const out: ProjectSummary[] = [];
    for (const id of ids) {
      const project = await this.readProject(id);
      if (project) {
        out.push({
          id: project.id,
          path: project.path,
          displayName: project.displayName,
          lastOpenedAt: project.lastOpenedAt,
        });
      }
    }
    out.sort((a, b) => (a.lastOpenedAt < b.lastOpenedAt ? 1 : -1));
    return out;
  }

  async findProjectByPath(path: string): Promise<Project | undefined> {
    const ids = await this.listProjectIds();
    for (const id of ids) {
      const project = await this.readProject(id);
      if (project?.path === path) return project;
    }
    return undefined;
  }

  async readProject(id: string): Promise<Project | undefined> {
    const file = join(this.projectsDir, id, "metadata.json");
    try {
      const raw = await readFile(file, "utf8");
      const parsed = JSON.parse(raw);
      const result = ProjectSchema.safeParse(parsed);
      return result.success ? result.data : undefined;
    } catch {
      return undefined;
    }
  }

  async openOrCreateProject(path: string): Promise<Project> {
    await this.ensure();
    const existing = await this.findProjectByPath(path);
    const now = new Date().toISOString();
    if (existing) {
      const updated: Project = { ...existing, lastOpenedAt: now };
      await this.writeProject(updated);
      return updated;
    }
    const project: Project = {
      id: randomUUID(),
      path,
      displayName: basename(path) || path,
      createdAt: now,
      lastOpenedAt: now,
      sessionIds: [],
    };
    await this.writeProject(project);
    return project;
  }

  async appendSessionId(projectId: string, sessionId: string): Promise<void> {
    const project = await this.readProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);
    if (project.sessionIds.includes(sessionId)) return;
    const updated: Project = { ...project, sessionIds: [...project.sessionIds, sessionId] };
    await this.writeProject(updated);
  }

  async upsertSession(projectId: string, meta: SessionMetadata): Promise<void> {
    const project = await this.readProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);
    const sessions = { ...(project.sessions ?? {}), [meta.id]: meta };
    const sessionIds = project.sessionIds.includes(meta.id)
      ? project.sessionIds
      : [...project.sessionIds, meta.id];
    await this.writeProject({ ...project, sessionIds, sessions });
  }

  async patchSession(
    projectId: string,
    sessionId: string,
    patch: Partial<SessionMetadata>,
  ): Promise<void> {
    const project = await this.readProject(projectId);
    if (!project) return;
    const existing = project.sessions?.[sessionId];
    if (!existing) return;
    const next: SessionMetadata = { ...existing, ...patch, id: sessionId };
    const sessions = { ...(project.sessions ?? {}), [sessionId]: next };
    await this.writeProject({ ...project, sessions });
  }

  async renameSessionId(projectId: string, oldId: string, newId: string): Promise<void> {
    if (oldId === newId) return;
    const project = await this.readProject(projectId);
    if (!project) return;
    const sessionIds = project.sessionIds.map((id) => (id === oldId ? newId : id));
    const sessions = { ...(project.sessions ?? {}) };
    const meta = sessions[oldId];
    if (meta) {
      delete sessions[oldId];
      sessions[newId] = { ...meta, id: newId };
    }
    await this.writeProject({ ...project, sessionIds, sessions });
  }

  async deleteSession(projectId: string, sessionId: string): Promise<void> {
    const project = await this.readProject(projectId);
    if (!project) return;
    const sessionIds = project.sessionIds.filter((id) => id !== sessionId);
    const sessions = { ...(project.sessions ?? {}) };
    delete sessions[sessionId];
    await this.writeProject({ ...project, sessionIds, sessions });
  }

  private async listProjectIds(): Promise<string[]> {
    await this.ensure();
    try {
      return await readdir(this.projectsDir);
    } catch {
      return [];
    }
  }

  private async writeProject(project: Project): Promise<void> {
    const dir = join(this.projectsDir, project.id);
    await mkdir(dir, { recursive: true });
    const file = join(dir, "metadata.json");
    const tmp = `${file}.${Date.now()}.tmp`;
    await writeFile(tmp, `${JSON.stringify(project, null, 2)}\n`, "utf8");
    await rename(tmp, file);
  }
}
