import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { type ComponentType, useState } from "react";
import { Glyph } from "../../components/glyph/index.js";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  GitMerge,
  GitPullRequestArrow,
  Loader2,
} from "../../components/icons/index.js";
import { useGitStore } from "./useGitStore.js";

interface Props {
  projectId: string;
  branch: string | undefined;
  ahead: number | undefined;
  behind: number | undefined;
  /** Configured remotes (`["origin", …]`). Empty → repo is purely local. */
  remotes: string[];
}

export function BranchHeader({ projectId, branch, ahead, behind, remotes }: Props) {
  const branches = useGitStore((s) => s.branchesByProject[projectId]);
  const checkout = useGitStore((s) => s.checkout);
  const pull = useGitStore((s) => s.pull);
  const push = useGitStore((s) => s.push);
  const openPr = useGitStore((s) => s.openPr);
  const [open, setOpen] = useState(false);
  // In-flight tracking lets the row spin its own icon (and disables the button) without
  // needing a global "git busy" flag. Each action keys its own flag; pull and push can
  // both be in flight at once in principle, though in practice users hit them serially.
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const list = branches ?? [];
  const aheadLabel = ahead && ahead > 0 ? `↑${ahead}` : undefined;
  const behindLabel = behind && behind > 0 ? `↓${behind}` : undefined;
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
      <RadixDropdown.Root open={open} onOpenChange={setOpen}>
        <RadixDropdown.Trigger asChild>
          <button
            type="button"
            className="pid-git-branch-trigger"
            aria-label="Select branch"
            disabled={!branch}
          >
            <Glyph kind="branch" size={14} />
            <span className="pid-git-branch-name">{branch ?? "detached"}</span>
            <span className="pid-git-branch-tracking">
              {aheadLabel ? <span data-tone="add">{aheadLabel}</span> : null}
              {behindLabel ? <span data-tone="del">{behindLabel}</span> : null}
            </span>
            <Glyph kind="chevron-down" size={10} className="pid-git-branch-chev" />
          </button>
        </RadixDropdown.Trigger>
        <RadixDropdown.Portal>
          <RadixDropdown.Content
            align="start"
            sideOffset={6}
            className="pid-picker-menu pid-git-branch-menu"
          >
            {list.length === 0 ? (
              <div className="pid-model-menu-empty">No branches</div>
            ) : (
              list.map((b) => {
                const isCurrent = b.name === branch;
                return (
                  <RadixDropdown.Item
                    key={b.name}
                    className="pid-picker-menu-item"
                    data-active={isCurrent || undefined}
                    onSelect={() => {
                      if (!isCurrent) void checkout(projectId, b.name);
                    }}
                  >
                    <span className="pid-picker-menu-item-check" aria-hidden>
                      {isCurrent ? <Check size={12} /> : <GitMerge size={12} />}
                    </span>
                    <span className="pid-picker-menu-item-label">{b.name}</span>
                  </RadixDropdown.Item>
                );
              })
            )}
          </RadixDropdown.Content>
        </RadixDropdown.Portal>
      </RadixDropdown.Root>

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
