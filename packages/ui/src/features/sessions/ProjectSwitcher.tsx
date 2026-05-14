import { ChevronDown, Folder, FolderOpen } from "../../components/icons/index.js";
import { type DropdownItem, DropdownMenu } from "../../components/ui/DropdownMenu.js";
import { useProjectsStore } from "./useProjectsStore.js";
import { useSessionsStore } from "./useSessionsStore.js";

export function ProjectSwitcher() {
  const client = useSessionsStore((s) => s.client);
  const projects = useProjectsStore((s) => s.projects);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const openFromDialog = useProjectsStore((s) => s.openProjectFromDialog);
  const openByPath = useProjectsStore((s) => s.openProjectByPath);
  const refreshSessions = useSessionsStore((s) => s.refreshSessions);
  const setActiveSessionId = useSessionsStore((s) => s.setActiveSessionId);

  const activeProject = projects.find((p) => p.id === activeProjectId);

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
            .then(() => {
              setActiveSessionId(undefined);
              return refreshSessions(project.id);
            })
            .catch(() => {});
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
            if (project) {
              setActiveSessionId(undefined);
              return refreshSessions(project.id);
            }
          })
          .catch(() => {});
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
          className="flex items-center gap-2 w-full min-w-0 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-panel-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
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
