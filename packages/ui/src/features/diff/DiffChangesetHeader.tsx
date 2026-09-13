import { useState } from "react";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog.js";
import { Check, GitCommitHorizontal, X } from "../../components/icons/index.js";
import { useI18nContext } from "../../i18n/i18n-react.js";
import { useRailState } from "../../layout/use-rail-state.js";
import { useRightPaneStore } from "../../layout/use-right-pane.js";
import { useGitStore } from "../git/useGitStore.js";
import { useStagingStore } from "../git/useStagingStore.js";
import { useProjectsStore } from "../sessions/useProjectsStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";

/**
 * Top-of-screen header for the ad-hoc diff route. Mirrors the "review · changeset" header
 * in the design mockup — a single kicker row with bulk actions on the right — but
 * scaled down to the data we actually have here:
 *
 *   - "N files" counts the active session's working-tree changes (same source as the Git
 *     tab's badge).
 *   - "revert all" → discards every tracked + untracked change after a confirm.
 *   - "stage hunks" → pre-checks every change in the commit composer's staging selection
 *     so the user can review-and-hit-commit in one motion. pi-deck commits per-path, so
 *     "stage" here means "queue for commit".
 *   - "commit" / "commit · N files" → switches the right pane to the Git tab and focuses
 *     the commit composer's textarea. The label appends "· N files" only when the user has
 *     actually selected a subset of the changeset to commit — otherwise the composer falls
 *     back to "commit everything" and a count would be misleading.
 *
 * The header sits above the existing per-file head (`pid-diff-tab-head`) inside `DiffTab`.
 * It hides itself when there's no active session or no project — there's nothing
 * meaningful to commit or revert in that state.
 */
export function DiffChangesetHeader() {
  const { LL } = useI18nContext();
  const projectId = useProjectsStore((s) => s.activeProjectId);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const changes = useGitStore((s) =>
    projectId ? s.statusByProject[projectId]?.changes : undefined,
  );
  const rollback = useGitStore((s) => s.rollback);
  const selectAllStaging = useStagingStore((s) => s.selectAll);
  const stagingRecord = useStagingStore((s) =>
    projectId ? s.selectedByProject[projectId] : undefined,
  );
  const focusGitComposer = useRightPaneStore((s) => s.focusGitComposer);
  const setRightVisible = useRailState((s) => s.setRightVisible);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState<"revert" | undefined>(undefined);

  const count = changes?.length ?? 0;
  const disabled = !projectId || count === 0;
  const selectedCount =
    stagingRecord && changes ? changes.filter((c) => stagingRecord.has(c.path)).length : 0;

  const handleRevertAll = () => {
    if (disabled) return;
    setConfirmOpen(true);
  };

  const confirmRevertAll = async () => {
    if (!projectId || !changes) return;
    const tracked: string[] = [];
    const untracked: string[] = [];
    for (const change of changes) {
      if (change.untracked) untracked.push(change.path);
      else tracked.push(change.path);
    }
    setBusy("revert");
    try {
      await rollback(projectId, { tracked, untracked });
    } finally {
      setBusy(undefined);
    }
  };

  const handleStageAll = () => {
    if (disabled || !projectId || !changes) return;
    selectAllStaging(
      projectId,
      changes.map((c) => c.path),
    );
  };

  const handleCommit = () => {
    if (disabled) return;

    setRightVisible(true);
    focusGitComposer();
  };

  // Outside an active session there's no project, no changeset, and no title — render
  // nothing so the diff screen falls back to its file-scoped head only.
  if (!projectId || !activeSessionId) return null;

  return (
    <header className="pid-diff-changeset-head">
      <div className="pid-diff-changeset-head-row">
        <span className="pid-mono-label">{LL.diff.changeset.eyebrow()}</span>
        <span className="pid-tag">{LL.diff.changeset.fileCount({ count })}</span>
        <span className="pid-diff-changeset-head-spacer" />
        <div className="pid-diff-changeset-head-actions">
          <button
            type="button"
            className="pid-git-commit-btn"
            onClick={handleRevertAll}
            disabled={disabled || busy === "revert"}
            title={
              disabled ? LL.diff.changeset.revertAllNothing() : LL.diff.changeset.revertAllTitle()
            }
          >
            <X size={12} aria-hidden /> {LL.diff.changeset.revertAll()}
          </button>
          <button
            type="button"
            className="pid-git-commit-btn"
            onClick={handleStageAll}
            disabled={disabled}
            title={disabled ? LL.diff.changeset.stageNothing() : LL.diff.changeset.stageTitle()}
          >
            <GitCommitHorizontal size={12} aria-hidden /> {LL.diff.changeset.stageHunks()}
          </button>
          <button
            type="button"
            className="pid-git-commit-btn pid-git-commit-btn-primary"
            onClick={handleCommit}
            disabled={disabled}
            title={disabled ? LL.diff.changeset.commitNothing() : LL.diff.changeset.commitTitle()}
          >
            <Check size={12} aria-hidden />{" "}
            {selectedCount > 0
              ? LL.diff.commitFiles({ count: selectedCount })
              : LL.diff.changeset.commit()}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={LL.diff.changeset.confirmTitle()}
        description={LL.diff.revertAllConfirm({ count })}
        confirmLabel={LL.diff.changeset.confirmLabel()}
        destructive
        onConfirm={confirmRevertAll}
      />
    </header>
  );
}
