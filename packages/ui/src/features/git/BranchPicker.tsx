import type { GitBranchInfo } from "@pi-deck/core/git/types.js";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Glyph } from "../../components/glyph/index.js";
import { Check, Copy, CornerDownLeft, Plus, Search, Star } from "../../components/icons/index.js";
import { relativeTime } from "../../lib/format/relative-time.js";
import { useGitStore } from "./useGitStore.js";

interface Props {
  projectId: string;
  branch: string | undefined;
  ahead: number | undefined;
  behind: number | undefined;
  /** Upstream ref name (e.g. `origin/pi/auto-mcp-discover`). Renders the "tracks" row. */
  upstream: string | undefined;
}

export function BranchPicker({ projectId, branch, ahead, behind, upstream }: Props) {
  const branches = useGitStore((s) => s.branchesByProject[projectId]);
  const branchesError = useGitStore((s) => s.errorByProject[projectId]);
  const branchesLoading = useGitStore((s) => s.loadingByProject[projectId] ?? false);
  const checkout = useGitStore((s) => s.checkout);
  const createBranch = useGitStore((s) => s.createBranch);
  const copyBranchName = useGitStore((s) => s.copyBranchName);
  const refreshBranches = useGitStore((s) => s.refresh);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [createValue, setCreateValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  const aheadLabel = ahead && ahead > 0 ? `↑${ahead}` : undefined;
  const behindLabel = behind && behind > 0 ? `↓${behind}` : undefined;

  // Reset transient UI state on close so the next open starts clean. Also kick a refresh
  // every time we open — defends against stale lists if the initial mount-time fetch
  // hadn't completed (or had failed) by the time the user clicked the trigger.
  useEffect(() => {
    if (open) {
      setQuery("");
      setCreateValue("");
      void refreshBranches(projectId);
      // Search input gets focus instead of the menu's default first-item-focus — same
      // trick the intro PidBranchPicker uses to keep keyboard typing alive.
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [open, projectId, refreshBranches]);

  const allBranches = useMemo(() => branches ?? [], [branches]);

  // Pick the default branch off the list — first hit of main/master, or the current
  // branch's upstream as a last resort. Used for the "+ new branch from <X>" footer.
  const defaultBranch = useMemo(() => {
    if (allBranches.some((b) => b.name === "main")) return "main";
    if (allBranches.some((b) => b.name === "master")) return "master";
    return branch ?? "HEAD";
  }, [allBranches, branch]);

  const trimmedQuery = query.trim();
  const filtered = useMemo(() => {
    if (!trimmedQuery) return allBranches;
    const q = trimmedQuery.toLowerCase();
    return allBranches.filter((b) => b.name.toLowerCase().includes(q));
  }, [allBranches, trimmedQuery]);

  const onCheckout = (name: string) => {
    if (name === branch) {
      setOpen(false);
      return;
    }
    void checkout(projectId, name);
    setOpen(false);
  };

  const trimmedCreate = createValue.trim();
  const createConflict = useMemo(
    () => allBranches.some((b) => b.name === trimmedCreate),
    [allBranches, trimmedCreate],
  );

  const onCreate = () => {
    if (!trimmedCreate || createConflict) return;
    void createBranch(projectId, trimmedCreate);
    setOpen(false);
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") return; // let Radix close
    if (e.key === "Enter") {
      // Enter checks out the top filtered match; the footer input owns the create flow,
      // so we don't try to overload Enter with two meanings.
      e.preventDefault();
      if (filtered.length > 0) {
        const first = filtered[0];
        if (first) onCheckout(first.name);
      }
      return;
    }
    // Block Radix DropdownMenu's built-in typeahead while the user is searching.
    e.stopPropagation();
  };

  const onCreateKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") return; // let Radix close
    if (e.key === "Enter") {
      e.preventDefault();
      onCreate();
      return;
    }
    e.stopPropagation();
  };

  return (
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
          className="pid-branch-picker"
          // Search input owns focus inside the menu (Radix would otherwise auto-focus
          // the first item, which both steals keystrokes and lights up an item we don't
          // want highlighted on open).
          {...({ onOpenAutoFocus: (e: Event) => e.preventDefault() } as Record<string, unknown>)}
        >
          <header className="pid-branch-picker-head">
            <div className="pid-branch-picker-head-top">
              <span className="pid-branch-picker-eyebrow">Current</span>
              <span className="pid-branch-picker-head-spacer" />
              <button
                type="button"
                className="pid-branch-picker-head-btn"
                onClick={() => branch && void copyBranchName(branch)}
                title="Copy branch name"
                aria-label="Copy branch name"
                disabled={!branch}
              >
                <Copy size={12} aria-hidden />
              </button>
            </div>
            <div className="pid-branch-picker-head-name">{branch ?? "detached"}</div>
            {upstream ? (
              <div className="pid-branch-picker-head-upstream">
                <Glyph kind="branch" size={11} />
                <span>{upstream}</span>
              </div>
            ) : null}
          </header>

          <div className="pid-branch-picker-search">
            <div className="pid-branch-picker-search-pill">
              <Search size={13} aria-hidden className="pid-branch-picker-search-icon" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="switch to branch…"
                className="pid-branch-picker-search-input"
                aria-label="Search branches"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="pid-branch-picker-list">
            <div className="pid-branch-picker-section-head">Recent</div>
            {filtered.length === 0 ? (
              <div className="pid-branch-picker-empty">
                {emptyMessage(allBranches.length, branchesLoading, branchesError, trimmedQuery)}
              </div>
            ) : (
              filtered.map((b) => (
                <BranchRow
                  key={b.name}
                  branch={b}
                  isCurrent={b.name === branch}
                  onSelect={() => onCheckout(b.name)}
                />
              ))
            )}
          </div>

          <footer className="pid-branch-picker-footer">
            <div className="pid-branch-picker-create-pill">
              <Plus size={12} aria-hidden className="pid-branch-picker-create-plus" />
              <input
                ref={createInputRef}
                type="text"
                value={createValue}
                onChange={(e) => setCreateValue(e.target.value)}
                onKeyDown={onCreateKeyDown}
                placeholder={`new branch from ${defaultBranch}`}
                className="pid-branch-picker-create-input"
                aria-label={`Create new branch from ${defaultBranch}`}
                autoComplete="off"
                spellCheck={false}
              />
              {trimmedCreate && !createConflict ? (
                <span className="pid-branch-picker-create-kbd" aria-hidden>
                  <CornerDownLeft size={11} />
                </span>
              ) : null}
            </div>
          </footer>
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}

/**
 * Resolve the right one-liner for the empty state. Splitting it out keeps the JSX above
 * focused on layout and gives us one place to tune the wording for each path —
 * loading, error, "no matches under this filter", or genuinely empty repo.
 */
function emptyMessage(
  total: number,
  loading: boolean,
  error: string | undefined,
  query: string,
): string {
  if (error) return `Failed to load branches: ${error}`;
  if (loading && total === 0) return "Loading branches…";
  if (total === 0) return "No branches yet.";
  if (query) return `No branches match "${query}".`;
  return "No branches.";
}

interface BranchRowProps {
  branch: GitBranchInfo;
  isCurrent: boolean;
  onSelect: () => void;
}

function BranchRow({ branch, isCurrent, onSelect }: BranchRowProps) {
  // Icon precedence: current > merged > plain. Mirrors the screenshot — `★` for the active
  // branch, `✓` (in the merged tone) for branches reachable from default, hollow `○` for
  // everything else.
  const icon = isCurrent ? (
    <Star size={12} className="pid-branch-row-icon" data-tone="current" aria-hidden />
  ) : branch.merged ? (
    <Check size={12} className="pid-branch-row-icon" data-tone="merged" aria-hidden />
  ) : (
    <span className="pid-branch-row-icon pid-branch-row-icon-dot" aria-hidden />
  );

  return (
    <RadixDropdown.Item
      className="pid-branch-row"
      data-current={isCurrent || undefined}
      data-merged={branch.merged || undefined}
      onSelect={onSelect}
    >
      {icon}
      <span className="pid-branch-row-name">{branch.name}</span>
      {branch.merged && !isCurrent ? <span className="pid-branch-row-merged">merged</span> : null}
      {branch.lastActivityAt ? (
        <span className="pid-branch-row-time">{relativeTime(branch.lastActivityAt)}</span>
      ) : null}
    </RadixDropdown.Item>
  );
}
