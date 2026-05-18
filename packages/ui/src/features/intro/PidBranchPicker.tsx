import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import Fuse from "fuse.js";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Glyph } from "../../components/glyph/index.js";
import { Check, CornerDownLeft, GitMerge, Plus, Search } from "../../components/icons/index.js";
import { useGitStore } from "../git/useGitStore.js";

interface Props {
  projectId: string | undefined;
}

export function PidBranchPicker({ projectId }: Props) {
  const branches = useGitStore((s) => (projectId ? s.branchesByProject[projectId] : undefined));
  const currentBranch = useGitStore((s) =>
    projectId ? s.currentBranchByProject[projectId] : undefined,
  );
  const checkout = useGitStore((s) => s.checkout);
  const createBranch = useGitStore((s) => s.createBranch);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset query + refocus the input each time the popover opens. Mirrors PidModelPicker.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setSubmitting(false);
      return;
    }
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open]);

  const allBranches = useMemo(() => branches ?? [], [branches]);

  const fuse = useMemo(
    () =>
      new Fuse(allBranches, {
        keys: ["name"],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [allBranches],
  );

  const trimmedQuery = query.trim();
  const filtered = useMemo(() => {
    if (!trimmedQuery) return allBranches;
    return fuse.search(trimmedQuery).map((r) => r.item);
  }, [allBranches, trimmedQuery, fuse]);

  const exactMatch = useMemo(
    () => allBranches.find((b) => b.name === trimmedQuery),
    [allBranches, trimmedQuery],
  );

  // Show the "+ Create branch <query>" row when the user has typed a name that doesn't
  // match any existing branch (fuzzy or exact). The list is fully replaced in that case —
  // matches the mockup where typing `new-branch` collapses the dropdown to the create CTA.
  const showCreate =
    trimmedQuery.length > 0 && !exactMatch && filtered.length === 0 && projectId !== undefined;

  const onCheckout = (name: string) => {
    if (!projectId) {
      setOpen(false);
      return;
    }
    if (name === currentBranch) {
      setOpen(false);
      return;
    }
    void checkout(projectId, name);
    setOpen(false);
  };

  const onCreate = async () => {
    if (!projectId || !trimmedQuery || exactMatch || submitting) return;
    setSubmitting(true);
    try {
      await createBranch(projectId, trimmedQuery);
      setOpen(false);
    } catch {
      // useGitStore surfaces a toast on failure; keep the dropdown open so the user can retry.
      setSubmitting(false);
    }
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") return; // let Radix close
    if (e.key === "Enter") {
      e.preventDefault();
      if (showCreate) {
        void onCreate();
      } else if (filtered.length > 0) {
        const first = filtered[0];
        if (first) onCheckout(first.name);
      }
      return;
    }
    // Block Radix DropdownMenu's built-in typeahead while the user is searching.
    e.stopPropagation();
  };

  return (
    <RadixDropdown.Root open={open} onOpenChange={setOpen}>
      <RadixDropdown.Trigger asChild disabled={!projectId}>
        <button type="button" className="pid-picker-trigger" aria-label="Select branch">
          <GitMerge size={12} aria-hidden />
          <span className="pid-picker-trigger-label">{currentBranch || "none"}</span>
          <Glyph kind="chevron-down" size={10} className="pid-picker-trigger-chev" />
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align="start"
          sideOffset={6}
          className="pid-picker-menu pid-branch-menu"
          // The search input owns focus inside the menu — same trick PidModelPicker uses.
          {...({ onOpenAutoFocus: (e: Event) => e.preventDefault() } as Record<string, unknown>)}
        >
          <div className="pid-model-menu-search">
            <Search size={14} aria-hidden className="pid-model-menu-search-icon" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search or type new branch…"
              className="pid-model-menu-search-input"
              aria-label="Search or type new branch"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="pid-model-menu-list">
            {showCreate ? (
              <RadixDropdown.Item
                className="pid-branch-menu-create"
                onSelect={(e) => {
                  e.preventDefault();
                  void onCreate();
                }}
              >
                <span className="pid-branch-menu-create-icon" aria-hidden>
                  <Plus size={12} />
                </span>
                <span className="pid-branch-menu-create-label">
                  Create branch <span className="pid-branch-menu-create-name">{trimmedQuery}</span>
                </span>
                <span className="pid-branch-menu-create-kbd" aria-hidden>
                  <CornerDownLeft size={12} />
                </span>
              </RadixDropdown.Item>
            ) : (
              <>
                <div className="pid-model-menu-section-head">
                  <span>Branch</span>
                </div>
                {filtered.length === 0 ? (
                  <div className="pid-model-menu-empty">
                    {allBranches.length === 0 ? "No branches" : "No matches"}
                  </div>
                ) : (
                  filtered.map((b) => {
                    const isActive = b.name === currentBranch;
                    return (
                      <RadixDropdown.Item
                        key={b.name}
                        className="pid-model-menu-item"
                        data-active={isActive || undefined}
                        onSelect={() => onCheckout(b.name)}
                      >
                        <span className="pid-model-menu-item-check" aria-hidden>
                          {isActive ? <Check size={12} /> : null}
                        </span>
                        <span className="pid-model-menu-item-label">{b.name}</span>
                      </RadixDropdown.Item>
                    );
                  })
                )}
              </>
            )}
          </div>
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}
