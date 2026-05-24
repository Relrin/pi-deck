import { useState } from "react";
import { ArrowUpFromLine, GitCommitHorizontal, Loader2 } from "../../components/icons/index.js";
import { useGitStore } from "./useGitStore.js";

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

  const commit = useGitStore((s) => s.commit);
  const push = useGitStore((s) => s.push);

  const canSubmit = message.trim().length > 0 && busy === undefined;

  const runCommit = async (alsoPush: boolean) => {
    if (!canSubmit) return;
    setBusy(alsoPush ? "commit-push" : "commit");
    try {
      const result = await commit(projectId, { message: message.trim(), amend });
      if (!result) return;
      // Clear the composer on success so the next commit doesn't accidentally reuse the
      // previous message. Reset amend too — it's a one-shot intent, not a sticky pref.
      setMessage("");
      setAmend(false);
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
