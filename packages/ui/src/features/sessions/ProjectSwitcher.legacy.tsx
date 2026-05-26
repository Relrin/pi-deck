import { ChevronDown, Folder, FolderOpen } from "../../components/icons/index.js";
import { type DropdownItem, DropdownMenu } from "../../components/ui/DropdownMenu.js";
import { humanizeError } from "../../lib/format/humanize-error.js";
import { useNotificationStore } from "../_status/useNotificationStore.js";
import { useProjectsStore } from "./useProjectsStore.js";
import { useSessionsStore } from "./useSessionsStore.js";

export function ProjectSwitcher() {
  const client = useSessionsStore((s) => s.client);
  const projects = useProjectsStore((s) => s.projects);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const openFromDialog = useProjectsStore((s) => s.openProjectFromDialog);
  const openByPath = useProjectsStore((s) => s.openProjectByPath);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const onProjectSwitched = async (projectId: string) => {
    const sessionsStore = useSessionsStore.getState();
    const remembered = useProjectsStore.getState().lastActiveSessionByProject[projectId];
    sessionsStore.setActiveSessionId(undefined);
    await sessionsStore.refreshSessions(projectId);
    if (remembered && sessionsStore.sessions.some((s) => s.id === remembered)) {
      await sessionsStore.activateSession(remembered);
    }
  };

  const items: DropdownItem[] = [
    ...projects.map(
      (project): DropdownItem => ({
        key: project.id,
        label: (
          <span className="flex items-center gap-2 truncate">
            <Folder size={14} className="shrink-0" />
            <span className="truncate">{project.displayName}</span>
          </span>
        ),
        onSelect: () => {
          if (!client) return;
          openByPath(client, project.path)
            .then(() => onProjectSwitched(project.id))
            .catch((err) => {
              useNotificationStore.getState().error(humanizeError(err, "Failed to switch project"));
            });
        },
      }),
    ),
    {
      key: "open-folder",
      label: (
        <span className="flex items-center gap-2 text-[var(--color-accent)]">
          <FolderOpen size={14} className="shrink-0" />
          Open folder…
        </span>
      ),
      onSelect: () => {
        if (!client) return;
        openFromDialog(client)
          .then((project) => {
            if (project) return onProjectSwitched(project.id);
          })
          .catch((err) => {
            useNotificationStore.getState().error(humanizeError(err, "Failed to open folder"));
          });
      },
      separatorBefore: projects.length > 0,
    },
  ];

  return (
    <DropdownMenu
      align="start"
      trigger={
        <button
          type="button"
          className="flex items-center gap-2 w-full min-w-0 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-panel-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          title={activeProject?.path}
        >
          <Folder size={14} className="shrink-0 text-[var(--color-text-muted)]" />
          <span className="truncate flex-1 text-left">
            {activeProject?.displayName ?? "Open folder…"}
          </span>
          <ChevronDown size={14} className="shrink-0 text-[var(--color-text-muted)]" />
        </button>
      }
      items={items}
    />
  );
}
