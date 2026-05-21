import { useState } from "react";
import { Glyph } from "../../components/glyph/index.js";

interface Props {
  /** Short SHA of HEAD; rendered after the "amend" checkbox like in the screenshot. */
  headShortSha: string | undefined;
}

/**
 * Visual-only commit composer matching the design mockup. The textarea, "amend previous
 * commit" checkbox, and the three action buttons are present so the panel reads as complete;
 * none of them dispatch a write yet — plan 007 is read-only. Wiring `commit` / `commit & push`
 * / `generate` lands in a later plan; until then the buttons carry an explanatory `title`.
 */
export function CommitComposer({ headShortSha }: Props) {
  const [message, setMessage] = useState("");
  const [amend, setAmend] = useState(false);

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

      <div className="pid-git-commit-actions">
        <button
          type="button"
          className="pid-git-commit-btn pid-git-commit-btn-primary"
          title="Commit — coming in a later plan"
        >
          <Glyph kind="commit" size={12} />
          commit
        </button>
        <button
          type="button"
          className="pid-git-commit-btn pid-git-commit-btn-primary"
          title="Commit & push — coming in a later plan"
        >
          <Glyph kind="arrow-right" size={12} />
          commit & push
        </button>
      </div>
    </div>
  );
}
