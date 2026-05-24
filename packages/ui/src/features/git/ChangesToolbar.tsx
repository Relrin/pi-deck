import { type ComponentType, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Loader2,
  RefreshCw,
  Undo2,
} from "../../components/icons/index.js";
import { useGitStore } from "./useGitStore.js";
import { useStagingStore } from "./useStagingStore.js";

interface Props {
  projectId: string;
}

/**
 * Toolbar of working-tree operations rendered at the top of the changes section.
 *   - refresh: re-read git state from disk (status + branches + commits + hunks).
 *   - rollback: discard selected files' edits, restoring them to HEAD.
 *   - stash:    save current changes (selected paths if any, otherwise the whole tree).
 *   - apply:    `git stash pop` — restore the latest stash entry.
 *
 * Each button shows a spinner while its action is in flight; the row tracks per-button
 * busy state so simultaneous clicks on different actions don't fight over a single flag.
 * Rollback and stash require a non-empty selection — the parent (ChangesList) reads the
 * staging store and tells us via `hasSelection` so we can disable the buttons.
 */
export function ChangesToolbar({ projectId }: Props) {
  const refreshAll = useGitStore((s) => s.refreshAll);
  const rollback = useGitStore((s) => s.rollback);
  const stash = useGitStore((s) => s.stash);
  const stashPop = useGitStore((s) => s.stashPop);
  const changes = useGitStore((s) => s.statusByProject[projectId]?.changes);
  const selectedRecord = useStagingStore((s) => s.selectedByProject[projectId]);
  const [busy, setBusy] = useState<string | undefined>(undefined);

  const selected = changes?.filter((c) => selectedRecord?.has(c.path)) ?? [];
  const hasSelection = selected.length > 0;

  const wrap = (key: string, fn: () => Promise<unknown>) => async () => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(undefined);
    }
  };

  const handleRollback = wrap("rollback", async () => {
    const tracked: string[] = [];
    const untracked: string[] = [];
    for (const c of selected) {
      if (c.untracked) untracked.push(c.path);
      else tracked.push(c.path);
    }
    await rollback(projectId, { tracked, untracked });
  });

  const handleStash = wrap("stash", async () => {
    const paths = selected.map((c) => c.path);
    await stash(projectId, paths.length > 0 ? paths : undefined);
  });

  return (
    <div className="pid-git-changes-toolbar" role="toolbar" aria-label="Working tree actions">
      <ToolbarButton
        icon={RefreshCw}
        label="refresh"
        title="Refresh git state from disk"
        busy={busy === "refresh"}
        disabled={Boolean(busy)}
        onClick={wrap("refresh", () => refreshAll(projectId))}
      />
      <ToolbarButton
        icon={Undo2}
        label="rollback"
        title={hasSelection ? "Rollback selected files to HEAD" : "Select files to roll back"}
        busy={busy === "rollback"}
        disabled={!hasSelection || Boolean(busy)}
        onClick={handleRollback}
      />
      <span className="pid-git-changes-toolbar-sep" aria-hidden />
      <ToolbarButton
        icon={Archive}
        label="stash"
        title={hasSelection ? "Stash selected changes" : "Stash all working-tree changes"}
        busy={busy === "stash"}
        disabled={Boolean(busy)}
        onClick={handleStash}
      />
      <ToolbarButton
        icon={ArchiveRestore}
        label="apply"
        title="Apply and drop the latest stash entry"
        busy={busy === "apply"}
        disabled={Boolean(busy)}
        onClick={wrap("apply", () => stashPop(projectId))}
      />
    </div>
  );
}

interface ToolbarButtonProps {
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean; className?: string }>;
  label: string;
  title: string;
  busy?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function ToolbarButton({ icon: Icon, label, title, busy, disabled, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className="pid-git-changes-toolbar-btn"
      title={title}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {busy ? (
        <Loader2 size={14} aria-hidden className="pid-spin" />
      ) : (
        <Icon size={14} aria-hidden />
      )}
    </button>
  );
}
