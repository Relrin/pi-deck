import { useEffect, useRef, useState } from "react";
import { Search, Settings2 } from "../../components/icons/index.js";
import { useI18nContext } from "../../i18n/i18n-react.js";
import { SessionsFilterPopover } from "./SessionsFilterPopover";

export function RailFilterBar({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (next: string) => void;
}) {
  const { LL } = useI18nContext();
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
        <Search size={12} />
        <input
          type="text"
          className="pid-rail-sessions-filter-input"
          placeholder={LL.sessions.filter.searchPlaceholder()}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label={LL.sessions.filter.label()}
        />
      </span>
      <button
        type="button"
        className="pid-rail-filterbar-trigger"
        data-active={open || undefined}
        aria-expanded={open}
        aria-label={LL.sessions.filter.controls()}
        onClick={() => setOpen((v) => !v)}
      >
        <Settings2 size={12} />
      </button>
      {open ? <SessionsFilterPopover onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
