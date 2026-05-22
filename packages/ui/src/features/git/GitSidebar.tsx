import { useEffect } from "react";
import { useNavStore } from "../../lib/useNavStore.js";
import { useProjectsStore } from "../sessions/useProjectsStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { BranchHeader } from "./BranchHeader.js";
import { ChangesList } from "./ChangesList.js";
import { CommitComposer } from "./CommitComposer.js";
import { EmptyState } from "./EmptyState.js";
import { useGitStore } from "./useGitStore.js";
import { useTurnFileTouches } from "./useTurnFileTouches.js";

export function GitSidebar() {
  const projectId = useProjectsStore((s) => s.activeProjectId);
  // The gate is the conjunction of: project loaded, WS client live, an active session id,
  // AND the center column is actually showing that session. The last condition matters
  // because the topbar's "Back to start" button flips `screen` to "blank" without clearing
  // `activeSessionId` — without checking `screen`, the git tab would keep showing data while
  // the user is on the blank/intro screen.
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

  const inSession = screen === "session" && Boolean(activeSessionId);

  useEffect(() => {
    // Only hydrate while the user is actually viewing a session. On blank / editor / diff /
    // history screens we keep the panel quiet — no branch row, no changes list, no spinner.
    // Re-hydration on first WS connect + per-session switch is handled by the reactive deps.
    if (!projectId || !client || !inSession) return;
    void refreshStatus(projectId);
    void refreshBranches(projectId);
  }, [projectId, client, inSession, refreshStatus, refreshBranches]);

  const touched = useTurnFileTouches(status?.root);

  // Not viewing a session → don't surface anything inside the Git tab. Covers the blank
  // screen, "Back to start", and any future non-session route.
  if (!projectId || !inSession) {
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
      />
      <ChangesList changes={status.changes} totals={status.totals} touched={touched} />
      <CommitComposer headShortSha={headShortSha} />
    </div>
  );
}
