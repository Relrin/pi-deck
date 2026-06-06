import { useProjectsStore } from "../sessions/useProjectsStore.js";

/**
 * Default working directory for a new terminal: the active session's root folder, which is the
 * active project's path. The shell thereby inherits the session's git branch (the working tree
 * is already checked out on it) — no `git checkout` is performed by the terminal. Returns null
 * when no project is open, in which case the panel shows an empty state instead of spawning.
 */
export function resolveDefaultCwd(): string | null {
  const { projects, activeProjectId } = useProjectsStore.getState();
  const project = projects.find((p) => p.id === activeProjectId);
  return project?.path ?? null;
}
