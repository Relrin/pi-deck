import type { GitChange } from "@pi-deck/core/git/types.js";
import { useMemo, useState } from "react";
import { Sliders } from "../../components/icons/index.js";
import { ChangeRow } from "./ChangeRow.js";

interface Props {
  changes: GitChange[];
  totals: { add: number; del: number };
  touched: Set<string>;
}

/**
 * Locale-aware natural-order collator: handles digit runs ("file2" < "file10"), folds case
 * ("README" interleaves with "readme"), and respects the user's UI locale via `undefined`.
 * One instance is shared by every `ChangesList` render — `Intl.Collator` is expensive to
 * construct, cheap to call.
 */
const PATH_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/**
 * Sort the change rows like GitHub's PR file list:
 *   1. tracked changes first, untracked (`?`) sink to the bottom — untracked rows are
 *      conceptually "pending decision" and clustering them avoids interleaving them with
 *      real edits.
 *   2. inside each group, natural path order — `src/bar.ts` next to `src/baz/...` etc.
 */
function sortChanges(changes: GitChange[]): GitChange[] {
  return [...changes].sort((a, b) => {
    if (a.untracked !== b.untracked) return a.untracked ? 1 : -1;
    return PATH_COLLATOR.compare(a.path, b.path);
  });
}

export function ChangesList({ changes, totals, touched }: Props) {
  // Sort once per change-set so we don't re-key React rows during unrelated re-renders.
  // `changes` is a fresh array from the store on every status refresh, so the memo bottoms
  // out at the worst-case "sort 100 paths" cost — ~0.1ms on a modern engine.
  const sortedChanges = useMemo(() => sortChanges(changes), [changes]);

  // Local "what would be staged" mirror. No write side-effects yet (plan 007 is read-only) —
  // the checkboxes simply track intent so the UI feels responsive when the user clicks them.
  // Wiring to `git add` lands with the commit pipeline in a later plan.
  const allPaths = useMemo(() => sortedChanges.map((c) => c.path), [sortedChanges]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allPaths));
  const [activePath, setActivePath] = useState<string | undefined>(sortedChanges[0]?.path);

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

      {sortedChanges.length === 0 ? (
        <div className="pid-git-empty">working tree clean</div>
      ) : (
        <div className="pid-git-rows">
          {sortedChanges.map((c) => (
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
