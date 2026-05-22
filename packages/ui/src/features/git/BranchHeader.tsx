import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { type ComponentType, useState } from "react";
import { Glyph } from "../../components/glyph/index.js";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  GitMerge,
  GitPullRequestArrow,
} from "../../components/icons/index.js";
import { useGitStore } from "./useGitStore.js";

interface Props {
  projectId: string;
  branch: string | undefined;
  ahead: number | undefined;
  behind: number | undefined;
}

export function BranchHeader({ projectId, branch, ahead, behind }: Props) {
  const branches = useGitStore((s) => s.branchesByProject[projectId]);
  const checkout = useGitStore((s) => s.checkout);
  const [open, setOpen] = useState(false);

  const list = branches ?? [];
  const aheadLabel = ahead && ahead > 0 ? `↑${ahead}` : undefined;
  const behindLabel = behind && behind > 0 ? `↓${behind}` : undefined;

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
        <BranchAction icon={ArrowDownToLine} label="pull" />
        <BranchAction icon={ArrowUpFromLine} label="push" />
        <BranchAction icon={GitPullRequestArrow} label="open pr" />
      </div>
    </div>
  );
}

interface ActionProps {
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  label: string;
}

/**
 * Render-only branch action. Write operations land in a follow-up plan — the buttons exist
 * here so the visual rhythm of the branch row matches the design. Clicking is a no-op with a
 * tooltip explaining why.
 */
function BranchAction({ icon: Icon, label }: ActionProps) {
  return (
    <button
      type="button"
      className="pid-git-branch-action"
      title={`${label} — coming in a later plan`}
      aria-label={`${label} (not yet implemented)`}
    >
      <Icon size={16} aria-hidden />
      <span className="pid-git-branch-action-label">{label}</span>
    </button>
  );
}
