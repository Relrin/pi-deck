import type { CommandResponse } from "@pi-deck/core/protocol/commands.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavStore } from "../../lib/useNavStore.js";
import { useEditorStore } from "../editor/useEditorStore.js";
import { useGitStore } from "../git/useGitStore.js";
import { useProjectsStore } from "../sessions/useProjectsStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { DiffChangesetHeader } from "./DiffChangesetHeader.js";
import { DiffNavToolbar } from "./DiffNavToolbar.js";
import { DiffToolbar } from "./DiffToolbar.js";
import { DiffView } from "./DiffView.js";
import { neighborDiffFile, orderedDiffFiles } from "./diffNav.js";

type DiffPayload = CommandResponse<"diff.get">;

/** Clear the diff's sticky file header so a navigated-to change isn't hidden beneath it. */
const STICKY_PAD = 56;

/**
 * Vertical offsets (within `container`'s scroll space) of each change block — contiguous runs of
 * added/deleted lines, merged across short context gaps so navigation steps between hunks rather
 * than every individual line. The Pierre viewer renders the whole diff inline (the body is the
 * scroller), so all changed-line elements are present to measure.
 */
function changeBlockOffsets(container: HTMLElement): number[] {
  const host = container.querySelector("diffs-container");
  const root: ParentNode = host?.shadowRoot ?? container;
  const lines = root.querySelectorAll<HTMLElement>(
    '[data-line-type="change-addition"],[data-line-type="change-deletion"]',
  );

  if (lines.length === 0) return [];
  const cTop = container.getBoundingClientRect().top;
  const scroll = container.scrollTop;
  let lineH = 20;

  const tops: number[] = [];
  for (const el of lines) {
    const r = el.getBoundingClientRect();
    if (r.height > 0) lineH = r.height;
    tops.push(r.top - cTop + scroll);
  }
  tops.sort((a, b) => a - b);

  const blocks: number[] = [];
  let prev = Number.NEGATIVE_INFINITY;
  const gap = lineH * 4; // fold a few context lines between edits into one block (≈ a hunk)
  for (const t of tops) {
    if (t - prev > gap) blocks.push(t);
    prev = t;
  }
  return blocks;
}

/**
 * Full-screen surface mounted by `PidCenterRouter` when `useNavStore.screen` is
 * `git-diff`. Reads `diffTarget` from the nav store, fetches the working-tree-vs-HEAD
 * diff through the `diff.get` command, and feeds it to `DiffView`.
 *
 * Ad-hoc only — turn review opens through `ReviewPanel` instead and never routes
 * here. There is therefore no file list on the left: this surface is always scoped to
 * one file, and switching files happens by clicking another row in the git sidebar
 * (which writes the new target into the nav store and re-fetches via the effect), or via
 * the floating `DiffNavToolbar`'s compare-previous/next-file actions.
 */
export function DiffTab() {
  const client = useSessionsStore((s) => s.client);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const storedTarget = useNavStore((s) => s.diffTarget);

  const target = storedTarget && storedTarget.projectId === activeProjectId ? storedTarget : null;
  const [diff, setDiff] = useState<DiffPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);

  const changes = useGitStore((s) =>
    target ? s.statusByProject[target.projectId]?.changes : undefined,
  );
  const gitRoot = useGitStore((s) =>
    target ? s.statusByProject[target.projectId]?.root : undefined,
  );
  const openDiff = useNavStore((s) => s.openDiff);

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

  // Tracked changed files (those with a HEAD diff), in natural path order — the set the
  // compare-previous/next-file actions cycle through.
  const diffFiles = useMemo(() => orderedDiffFiles(changes), [changes]);
  const prevFile = target ? neighborDiffFile(diffFiles, target.path, -1) : undefined;
  const nextFile = target ? neighborDiffFile(diffFiles, target.path, 1) : undefined;

  const projectId = target?.projectId;
  const goToFile = useCallback(
    (path: string | undefined) => {
      if (path && projectId) openDiff({ projectId, path });
    },
    [openDiff, projectId],
  );

  const scrollToAdjacentDiff = useCallback((dir: -1 | 1) => {
    const c = bodyRef.current;
    if (!c) return;
    const blocks = changeBlockOffsets(c);
    if (blocks.length === 0) return;
    const anchor = c.scrollTop + STICKY_PAD;
    const eps = 4;
    const next =
      dir === 1
        ? blocks.find((b) => b > anchor + eps)
        : [...blocks].reverse().find((b) => b < anchor - eps);
    if (next == null) return; // already at the first/last change — no wrap
    c.scrollTo({ top: Math.max(0, next - STICKY_PAD), behavior: "smooth" });
  }, []);

  const handleJumpToSource = useCallback(() => {
    if (!target || !gitRoot) return;
    const base = gitRoot.replace(/\\/g, "/").replace(/\/+$/, "");
    const rel = target.path.replace(/\\/g, "/");
    useEditorStore
      .getState()
      .openFile({ projectId: target.projectId, absPath: `${base}/${rel}`, relPath: rel });
    useNavStore.getState().setScreen("editor");
  }, [target, gitRoot]);

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
          <DiffNavToolbar
            onPrevDiff={() => scrollToAdjacentDiff(-1)}
            onNextDiff={() => scrollToAdjacentDiff(1)}
            onJumpToSource={handleJumpToSource}
            onPrevFile={() => goToFile(prevFile)}
            onNextFile={() => goToFile(nextFile)}
            prevFileDisabled={prevFile === undefined}
            nextFileDisabled={nextFile === undefined}
          />
          <DiffToolbar />
        </div>
      </header>
      <div className="pid-diff-tab-body" ref={bodyRef}>
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
