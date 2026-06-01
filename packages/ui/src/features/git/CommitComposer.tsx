import { useEffect, useRef, useState } from "react";
import { ArrowUpFromLine, GitCommitHorizontal, Loader2 } from "../../components/icons/index.js";
import { useRightPaneStore } from "../../layout/use-right-pane.js";
import { useGitStore } from "./useGitStore.js";
import { useStagingStore } from "./useStagingStore.js";

interface Props {
  projectId: string;
  /** Short SHA of HEAD; rendered after the "amend" checkbox like in the screenshot. */
  headShortSha: string | undefined;
}

export function CommitComposer({ projectId, headShortSha }: Props) {
  const [message, setMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState<"commit" | "commit-push" | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const focusNonce = useRightPaneStore((s) => s.composerFocusNonce);
  useEffect(() => {
    if (focusNonce === 0) return; // initial seed value — no real request yet
    textareaRef.current?.focus();
  }, [focusNonce]);

  const commit = useGitStore((s) => s.commit);
  const push = useGitStore((s) => s.push);
  // Pull the latest changes list directly from the status snapshot so we can intersect
  // it with the user's checkbox selection — paths that have since been removed (a file
  // committed elsewhere, a path reverted) get filtered out before we hit `git add`.
  const changes = useGitStore((s) => s.statusByProject[projectId]?.changes);
  const stagingRecord = useStagingStore((s) => s.selectedByProject[projectId]);
  const resetStaging = useStagingStore((s) => s.resetProject);

  const canSubmit = message.trim().length > 0 && busy === undefined;

  const runCommit = async (alsoPush: boolean) => {
    if (!canSubmit) return;
    // Resolve the actual paths to stage from the user's explicit selection. Untracked
    // files are included — `git add` picks them up just fine.
    const allPaths = changes?.map((c) => c.path) ?? [];
    const selectedPaths = stagingRecord ? allPaths.filter((p) => stagingRecord.has(p)) : [];

    setBusy(alsoPush ? "commit-push" : "commit");
    try {
      const result = await commit(projectId, {
        message: message.trim(),
        amend,
        paths: selectedPaths.length > 0 ? selectedPaths : undefined,
      });
      if (!result) return;
      // Clear the composer on success so the next commit doesn't accidentally reuse the
      // previous message. Reset amend too — it's a one-shot intent, not a sticky pref.
      // Resetting the staging selection means any new working-tree changes that come in
      // after this commit are pre-checked again instead of starting unselected.
      setMessage("");
      setAmend(false);
      resetStaging(projectId);
      if (alsoPush) {
        await push(projectId, { forceWithLease: force });
        // Force-with-lease was a one-shot opt-in for this push; clear it once consumed.
        setForce(false);
      }
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="pid-git-section pid-git-commit-composer">
      <div className="pid-mono-label pid-git-section-label">commit</div>
      <div className="pid-composer-shell pid-git-commit-shell">
        <textarea
          ref={textareaRef}
          className="pid-composer-input pid-git-commit-input"
          rows={2}
          placeholder="describe the change…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      <label className="pid-git-commit-amend">
        <input
          type="checkbox"
          checked={amend}
          onChange={(e) => setAmend(e.target.checked)}
          className="pid-git-commit-amend-check"
        />
        <span>amend previous commit</span>
        <span className="pid-git-commit-amend-spacer" />
        {headShortSha ? <span className="pid-git-commit-amend-sha">{headShortSha}</span> : null}
      </label>

      <label className="pid-git-commit-amend">
        <input
          type="checkbox"
          checked={force}
          onChange={(e) => setForce(e.target.checked)}
          className="pid-git-commit-amend-check"
        />
        <span>force push</span>
        <span className="pid-git-commit-amend-spacer" />
        <span className="pid-git-commit-amend-sha">--force-with-lease</span>
      </label>

      <div className="pid-git-commit-actions">
        <button
          type="button"
          className="pid-git-commit-btn pid-git-commit-btn-primary"
          title={canSubmit ? "Commit" : "Enter a commit message"}
          disabled={!canSubmit}
          onClick={() => void runCommit(false)}
        >
          {busy === "commit" ? (
            <Loader2 size={12} aria-hidden className="pid-spin" />
          ) : (
            <GitCommitHorizontal size={12} aria-hidden />
          )}
          commit
        </button>
        <button
          type="button"
          className="pid-git-commit-btn pid-git-commit-btn-primary"
          title={canSubmit ? "Commit & push" : "Enter a commit message"}
          disabled={!canSubmit}
          onClick={() => void runCommit(true)}
        >
          {busy === "commit-push" ? (
            <Loader2 size={12} aria-hidden className="pid-spin" />
          ) : (
            <ArrowUpFromLine size={12} aria-hidden />
          )}
          commit &amp; push
        </button>
      </div>
    </div>
  );
}
