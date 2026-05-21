import { useEffect } from "react";
import { useProjectsStore } from "../sessions/useProjectsStore.js";
import { BranchHeader } from "./BranchHeader.js";
import { ChangesList } from "./ChangesList.js";
import { CommitComposer } from "./CommitComposer.js";
import { EmptyState } from "./EmptyState.js";
import { useGitStore } from "./useGitStore.js";
import { useTurnFileTouches } from "./useTurnFileTouches.js";

export function GitSidebar() {
  const projectId = useProjectsStore((s) => s.activeProjectId);
  const status = useGitStore((s) => (projectId ? s.statusByProject[projectId] : undefined));
  const commits = useGitStore((s) => (projectId ? s.commitsByProject[projectId] : undefined));
  const statusLoading = useGitStore((s) =>
    projectId ? (s.statusLoadingByProject[projectId] ?? false) : false,
  );
  const ensureStatus = useGitStore((s) => s.ensureStatus);
  const refreshBranches = useGitStore((s) => s.refresh);

  useEffect(() => {
    if (!projectId) return;
    void ensureStatus(projectId);
    void refreshBranches(projectId);
  }, [projectId, ensureStatus, refreshBranches]);

  const touched = useTurnFileTouches(status?.root);

  if (!projectId) {
    return <div className="pid-git-placeholder">Open a project to see git state.</div>;
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
      />
      <ChangesList changes={status.changes} totals={status.totals} touched={touched} />
      <CommitComposer headShortSha={headShortSha} />
    </div>
  );
}
