import { useEffect, useRef, useState } from "react";
import { Glyph } from "../../components/glyph";
import { SessionsFilterPopover } from "./SessionsFilterPopover";
import { dirtyCount, useSessionsFilterStore } from "./useSessionsFilterStore";

export function RailFilterBar({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const dirty = useSessionsFilterStore(dirtyCount);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapperRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrapperRef} className="pid-rail-filterbar">
      <span className="pid-rail-sessions-filter">
        <Glyph kind="search" size={12} />
        <input
          type="text"
          className="pid-rail-sessions-filter-input"
          placeholder="filter sessions…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Filter sessions"
        />
      </span>
      <button
        type="button"
        className="pid-rail-filterbar-trigger"
        data-active={open || undefined}
        data-dirty={dirty > 0 ? "true" : undefined}
        aria-expanded={open}
        aria-label="Sort, group, and filter sessions"
        onClick={() => setOpen((v) => !v)}
      >
        <Glyph kind="sliders" size={12} />
        {dirty > 0 ? <span className="pid-rail-filterbar-trigger-badge">{dirty}</span> : null}
      </button>
      {open ? <SessionsFilterPopover onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
