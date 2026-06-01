import type { CommandResponse } from "@pi-deck/core/protocol/commands.js";
import { useEffect, useState } from "react";
import { useNavStore } from "../../lib/useNavStore.js";
import { useProjectsStore } from "../sessions/useProjectsStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { DiffChangesetHeader } from "./DiffChangesetHeader.js";
import { DiffToolbar } from "./DiffToolbar.js";
import { DiffView } from "./DiffView.js";

type DiffPayload = CommandResponse<"diff.get">;

/**
 * Full-screen surface mounted by `PidCenterRouter` when `useNavStore.screen` is
 * `git-diff`. Reads `diffTarget` from the nav store, fetches the working-tree-vs-HEAD
 * diff through the `diff.get` command, and feeds it to `DiffView`.
 *
 * Ad-hoc only — turn review opens through `ReviewPanel` instead and never routes
 * here. There is therefore no file list on the left: this surface is always scoped to
 * one file, and switching files happens by clicking another row in the git sidebar
 * (which writes the new target into the nav store and re-fetches via the effect).
 */
export function DiffTab() {
  const client = useSessionsStore((s) => s.client);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const storedTarget = useNavStore((s) => s.diffTarget);

  const target = storedTarget && storedTarget.projectId === activeProjectId ? storedTarget : null;
  const [diff, setDiff] = useState<DiffPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !target) {
      setDiff(null);
      return;
    }
    let cancelled = false;
    setError(null);
    setDiff(null);
    client
      .call("diff.get", {
        projectId: target.projectId,
        path: target.path,
        baseline: "HEAD",
      })
      .then((result) => {
        if (cancelled) return;
        setDiff(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [client, target]);

  if (!target) {
    return (
      <div className="pid-route-placeholder">
        <span>Pick a file in the git sidebar to view its diff.</span>
      </div>
    );
  }

  return (
    <div className="pid-diff-tab">
      <DiffChangesetHeader />
      <header className="pid-diff-tab-head">
        <div className="pid-diff-tab-head-row">
          <span className="pid-diff-tab-path" title={target.path}>
            {target.path}
          </span>
          <DiffToolbar />
        </div>
      </header>
      <div className="pid-diff-tab-body">
        {error ? (
          <div className="pid-route-placeholder">
            <span>{error}</span>
          </div>
        ) : diff === null ? (
          <div className="pid-route-placeholder">
            <span>Loading diff…</span>
          </div>
        ) : diff.unified.length === 0 ? (
          <div className="pid-route-placeholder">
            <span>No changes vs HEAD.</span>
          </div>
        ) : (
          <DiffView unified={diff.unified} />
        )}
      </div>
    </div>
  );
}
