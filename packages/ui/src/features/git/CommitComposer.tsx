import { useState } from "react";
import { ArrowUpFromLine, GitCommitHorizontal } from "../../components/icons/index.js";

interface Props {
  /** Short SHA of HEAD; rendered after the "amend" checkbox like in the screenshot. */
  headShortSha: string | undefined;
}

/**
 * Visual-only commit composer matching the design mockup. The textarea, option checkboxes,
 * and the two action buttons are present so the panel reads as complete; none of them
 * dispatch a write yet — plan 007 is read-only. Wiring `commit` / `commit & push` lands in
 * a later plan; until then the buttons carry an explanatory `title`.
 */
export function CommitComposer({ headShortSha }: Props) {
  const [message, setMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const [force, setForce] = useState(false);

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
          title="Commit — coming in a later plan"
        >
          <GitCommitHorizontal size={12} aria-hidden />
          commit
        </button>
        <button
          type="button"
          className="pid-git-commit-btn pid-git-commit-btn-primary"
          title="Commit & push — coming in a later plan"
        >
          <ArrowUpFromLine size={12} aria-hidden />
          commit & push
        </button>
      </div>
    </div>
  );
}
