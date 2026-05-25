import { useEffect, useRef, useState } from "react";
import { Glyph } from "../../components/glyph";
import { SessionsFilterPopover } from "./SessionsFilterPopover";

export function RailFilterBar({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
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
        aria-expanded={open}
        aria-label="Sort, group, and filter sessions"
        onClick={() => setOpen((v) => !v)}
      >
        <Glyph kind="sliders" size={12} />
      </button>
      {open ? <SessionsFilterPopover onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
