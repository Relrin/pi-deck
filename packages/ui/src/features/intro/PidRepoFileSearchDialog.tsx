import * as RadixDialog from "@radix-ui/react-dialog";
import Fuse from "fuse.js";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, File, Search, X } from "../../components/icons/index.js";
import { humanizeError } from "../../lib/format/humanize-error.js";
import { useToastStore } from "../_status/useToastStore.js";
import { useProjectsStore } from "../sessions/useProjectsStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";

interface PidRepoFileSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (paths: string[]) => void;
}

interface FileEntry {
  path: string;
}

const RESULT_LIMIT = 20;

export function PidRepoFileSearchDialog({ open, onClose, onSelect }: PidRepoFileSearchDialogProps) {
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const client = useSessionsStore((s) => s.client);
  const [entries, setEntries] = useState<FileEntry[] | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lazy-load the project's file list the first time the dialog opens. Cached for subsequent
  // opens during the same session; switching the active project invalidates the cache.
  useEffect(() => {
    if (!open) return;
    if (!activeProjectId || !client) return;
    if (entries) return;
    setLoading(true);
    client
      .call("project.listFiles", { projectId: activeProjectId })
      .then((res) => setEntries(res.entries.map((e) => ({ path: e.path }))))
      .catch((err) => {
        useToastStore.getState().push(humanizeError(err, "Failed to list project files"), "error");
        setEntries([]);
      })
      .finally(() => setLoading(false));
  }, [open, activeProjectId, client, entries]);

  // Invalidate cached entries on project switch so the next open re-fetches.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — fire on activeProjectId change, ignore the inner setter refs.
  useEffect(() => {
    setEntries(undefined);
    setPicked(new Set());
    setQuery("");
  }, [activeProjectId]);

  // Focus the search input shortly after mount so keyboard-first users land where they expect.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(id);
  }, [open]);

  const fuse = useMemo(() => {
    if (!entries) return undefined;
    return new Fuse(entries, {
      keys: ["path"],
      threshold: 0.4,
      ignoreLocation: true,
      includeScore: true,
    });
  }, [entries]);

  const results = useMemo<FileEntry[]>(() => {
    if (!entries) return [];
    const trimmed = query.trim();
    if (!trimmed) return entries.slice(0, RESULT_LIMIT);
    if (!fuse) return [];
    return fuse.search(trimmed, { limit: RESULT_LIMIT }).map((r) => r.item);
  }, [entries, fuse, query]);

  // Reset highlight to the top whenever the result set changes (new query, fresh load).
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — react to the results identity itself.
  useEffect(() => {
    setActiveIdx(0);
  }, [results]);

  const toggle = (path: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const confirm = () => {
    if (picked.size === 0) {
      onClose();
      return;
    }
    onSelect([...picked]);
    setPicked(new Set());
    setQuery("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[activeIdx];
      if (item) toggle(item.path);
    }
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="pid-dialog-overlay" />
        <RadixDialog.Content className="pid-dialog pid-repo-search-dialog">
          <RadixDialog.Title className="sr-only">Reference from repo</RadixDialog.Title>
          <div className="pid-repo-search-input-row">
            <Search size={14} className="pid-repo-search-input-icon" />
            <input
              ref={inputRef}
              className="pid-repo-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={loading ? "Loading project files…" : "Search files…"}
              disabled={loading || !entries}
              aria-label="Search project files"
            />
            <button
              type="button"
              className="pid-repo-search-close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
          <div className="pid-repo-search-results" role="listbox">
            {loading && <div className="pid-repo-search-empty">Loading…</div>}
            {!loading && results.length === 0 && (
              <div className="pid-repo-search-empty">
                {entries && entries.length === 0
                  ? "No tracked files in this project."
                  : "No matches."}
              </div>
            )}
            {results.map((entry, ix) => {
              const isPicked = picked.has(entry.path);
              const isActive = ix === activeIdx;
              return (
                <button
                  key={entry.path}
                  type="button"
                  className="pid-repo-search-row"
                  data-active={isActive || undefined}
                  data-picked={isPicked || undefined}
                  onClick={() => toggle(entry.path)}
                  onMouseEnter={() => setActiveIdx(ix)}
                >
                  <span className="pid-repo-search-check" aria-hidden>
                    {isPicked ? <Check size={12} /> : <File size={12} />}
                  </span>
                  <span className="pid-repo-search-path">{entry.path}</span>
                </button>
              );
            })}
          </div>
          <div className="pid-repo-search-footer">
            <span className="pid-repo-search-hint">
              {picked.size === 0 ? "↑↓ navigate · ↵ toggle" : `${picked.size} selected`}
            </span>
            <button
              type="button"
              className="pid-composer-send"
              onClick={confirm}
              disabled={picked.size === 0}
            >
              Add{picked.size > 0 ? ` (${picked.size})` : ""}
            </button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
