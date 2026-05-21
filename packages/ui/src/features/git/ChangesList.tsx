import type { GitChange } from "@pi-deck/core/git/types.js";
import { useMemo, useState } from "react";
import { Sliders } from "../../components/icons/index.js";
import { ChangeRow } from "./ChangeRow.js";

interface Props {
  changes: GitChange[];
  totals: { add: number; del: number };
  touched: Set<string>;
}

export function ChangesList({ changes, totals, touched }: Props) {
  // Local "what would be staged" mirror. No write side-effects yet (plan 007 is read-only) —
  // the checkboxes simply track intent so the UI feels responsive when the user clicks them.
  // Wiring to `git add` lands with the commit pipeline in a later plan.
  const allPaths = useMemo(() => changes.map((c) => c.path), [changes]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allPaths));
  const [activePath, setActivePath] = useState<string | undefined>(changes[0]?.path);

  // Reconcile selection when the change set itself changes (files staged in another terminal,
  // a new untracked file dropped in). New paths come in pre-selected; removed paths drop out.
  const syncedSelected = useMemo(() => {
    const next = new Set<string>();
    for (const p of allPaths) {
      if (selected.has(p) || !selected.size) next.add(p);
    }
    return next;
  }, [allPaths, selected]);

  const toggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const stageAll = () => {
    setSelected(new Set(allPaths));
  };

  return (
    <div className="pid-git-section pid-git-changes">
      <div className="pid-git-section-head">
        <span className="pid-mono-label">changes</span>
        <span className="pid-tag">{changes.length}</span>
        <span className="pid-git-section-spacer" />
        <button
          type="button"
          className="pid-git-changes-icon"
          title="Group by hunk — coming in a later plan"
          aria-label="Group by hunk"
        >
          <Sliders size={12} />
        </button>
        <button
          type="button"
          className="pid-git-changes-stage-all"
          onClick={stageAll}
          title="Select all files for the next commit"
        >
          stage all
        </button>
      </div>

      <DiffBarTotals totals={totals} />

      {changes.length === 0 ? (
        <div className="pid-git-empty">working tree clean</div>
      ) : (
        <div className="pid-git-rows">
          {changes.map((c) => (
            <ChangeRow
              key={`${c.path}:${c.status}`}
              change={c}
              touched={touched.has(c.path)}
              selected={syncedSelected.has(c.path)}
              active={activePath === c.path}
              onToggle={() => toggle(c.path)}
              onSelect={() => setActivePath(c.path)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DiffBarTotals({ totals }: { totals: { add: number; del: number } }) {
  const sum = totals.add + totals.del;
  return (
    <div className="pid-git-diffbar-row">
      <div className="pid-git-diffbar" aria-hidden>
        {sum > 0 ? (
          <>
            <div
              className="pid-git-diffbar-add"
              style={{ width: `${(totals.add / sum) * 100}%` }}
            />
            <div
              className="pid-git-diffbar-del"
              style={{ width: `${(totals.del / sum) * 100}%` }}
            />
          </>
        ) : (
          <div className="pid-git-diffbar-empty" />
        )}
      </div>
      <span className="pid-git-diffbar-totals" aria-hidden>
        <span data-tone="add">+{totals.add}</span>
        <span className="pid-git-diffbar-sep">·</span>
        <span data-tone="del">−{totals.del}</span>
      </span>
    </div>
  );
}
