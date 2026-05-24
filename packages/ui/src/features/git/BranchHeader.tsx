import { type ComponentType, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  GitPullRequestArrow,
  Loader2,
} from "../../components/icons/index.js";
import { BranchPicker } from "./BranchPicker.js";
import { useGitStore } from "./useGitStore.js";

interface Props {
  projectId: string;
  branch: string | undefined;
  ahead: number | undefined;
  behind: number | undefined;
  /** Configured remotes (`["origin", …]`). Empty → repo is purely local. */
  remotes: string[];
  /** Upstream ref name (e.g. `origin/pi/auto-mcp-discover`). Threaded through to the
   * BranchPicker for the "tracks" row in its header. */
  upstream: string | undefined;
}

export function BranchHeader({ projectId, branch, ahead, behind, remotes, upstream }: Props) {
  const pull = useGitStore((s) => s.pull);
  const push = useGitStore((s) => s.push);
  const openPr = useGitStore((s) => s.openPr);
  // In-flight tracking lets the row spin its own icon (and disables the button) without
  // needing a global "git busy" flag. Each action keys its own flag; pull and push can
  // both be in flight at once in principle, though in practice users hit them serially.
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  // All three remote-side actions (pull / push / open PR) require *something* to talk to.
  // If `git remote` came back empty, the repo is local-only and the row stays disabled.
  const hasRemote = remotes.length > 0;
  const disabledReason = hasRemote ? undefined : "no remote configured";

  const wrap = (key: string, fn: () => Promise<unknown>) => async () => {
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      await fn();
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };

  return (
    <div className="pid-git-section pid-git-branch">
      <div className="pid-mono-label pid-git-section-label">branch</div>
      <BranchPicker
        projectId={projectId}
        branch={branch}
        ahead={ahead}
        behind={behind}
        upstream={upstream}
      />

      <div className="pid-git-branch-actions">
        <BranchAction
          icon={ArrowDownToLine}
          label="pull"
          disabledReason={disabledReason}
          busy={busy.pull}
          onClick={wrap("pull", () => pull(projectId))}
        />
        <BranchAction
          icon={ArrowUpFromLine}
          label="push"
          disabledReason={disabledReason}
          busy={busy.push}
          onClick={wrap("push", () => push(projectId))}
        />
        <BranchAction
          icon={GitPullRequestArrow}
          label="open pr"
          disabledReason={disabledReason}
          busy={busy.openPr}
          onClick={wrap("openPr", () => openPr(projectId))}
        />
      </div>
    </div>
  );
}

interface ActionProps {
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean; className?: string }>;
  label: string;
  /** When set, the button renders disabled and uses this string as the tooltip + a11y reason. */
  disabledReason?: string;
  busy?: boolean;
  onClick?: () => void;
}

function BranchAction({ icon: Icon, label, disabledReason, busy, onClick }: ActionProps) {
  const disabled = Boolean(disabledReason) || Boolean(busy);
  const tooltip = disabledReason ? `${label} — ${disabledReason}` : label;
  const ariaLabel = disabledReason ? `${label} (${disabledReason})` : label;
  return (
    <button
      type="button"
      className="pid-git-branch-action"
      title={tooltip}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
    >
      {busy ? (
        <Loader2 size={16} aria-hidden className="pid-spin" />
      ) : (
        <Icon size={16} aria-hidden />
      )}
      <span className="pid-git-branch-action-label">{label}</span>
    </button>
  );
}
