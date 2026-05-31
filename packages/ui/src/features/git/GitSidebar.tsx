import { useEffect } from "react";
import { isSessionContextScreen, useNavStore } from "../../lib/useNavStore.js";
import { useProjectsStore } from "../sessions/useProjectsStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { BranchHeader } from "./BranchHeader.js";
import { ChangesList } from "./ChangesList.js";
import { CommitComposer } from "./CommitComposer.js";
import { EmptyState } from "./EmptyState.js";
import { useGitStore } from "./useGitStore.js";
import { useGroupModeStore } from "./useGroupModeStore.js";
import { useTurnFileTouches } from "./useTurnFileTouches.js";

export function GitSidebar() {
  const projectId = useProjectsStore((s) => s.activeProjectId);

  const screen = useNavStore((s) => s.screen);
  const client = useSessionsStore((s) => s.client);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const status = useGitStore((s) => (projectId ? s.statusByProject[projectId] : undefined));
  const commits = useGitStore((s) => (projectId ? s.commitsByProject[projectId] : undefined));
  const statusLoading = useGitStore((s) =>
    projectId ? (s.statusLoadingByProject[projectId] ?? false) : false,
  );
  const refreshStatus = useGitStore((s) => s.refreshStatus);
  const refreshBranches = useGitStore((s) => s.refresh);
  const refreshHunks = useGitStore((s) => s.refreshHunks);
  const hunksByPath = useGitStore((s) => (projectId ? s.hunksByProject[projectId] : undefined));
  const groupMode = useGroupModeStore((s) => s.mode);

  const inSessionContext = isSessionContextScreen(screen) && Boolean(activeSessionId);

  useEffect(() => {
    if (!projectId || !client || !inSessionContext) return;
    void refreshStatus(projectId);
    void refreshBranches(projectId);
  }, [projectId, client, inSessionContext, refreshStatus, refreshBranches]);

  useEffect(() => {
    // Hunks are expensive to compute (one extra `git diff` per refresh), so we only fetch
    // them when the user has actually switched to the "hunk" grouping. `applyStatusChanged`
    // drops the cached entry on every change event, so this effect re-fires and re-fetches
    // whenever the working tree moves under us.
    if (!projectId || !client || !inSessionContext) return;
    if (groupMode !== "hunk") return;
    if (hunksByPath) return;
    void refreshHunks(projectId);
  }, [projectId, client, inSessionContext, groupMode, hunksByPath, refreshHunks]);

  const touched = useTurnFileTouches(status?.root);

  if (!projectId || !inSessionContext) {
    return <div className="pid-git-placeholder">Start or open a session to see git state.</div>;
  }

  if (statusLoading && !status) {
    return <div className="pid-git-placeholder">Reading git…</div>;
  }

  if (status && !status.isRepo) {
    return <EmptyState projectId={projectId} />;
  }

  if (!status) {
    return <div className="pid-git-placeholder">No git data.</div>;
  }

  const headShortSha = commits?.[0]?.shortSha;

  return (
    <div className="pid-git">
      <BranchHeader
        projectId={projectId}
        branch={status.branch}
        ahead={status.ahead}
        behind={status.behind}
        remotes={status.remotes}
        upstream={status.upstream}
      />
      <ChangesList
        projectId={projectId}
        changes={status.changes}
        totals={status.totals}
        touched={touched}
        hunksByPath={hunksByPath}
      />
      <CommitComposer projectId={projectId} headShortSha={headShortSha} />
    </div>
  );
}
