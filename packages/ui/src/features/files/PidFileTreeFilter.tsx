import { type ChangeEvent, forwardRef, type KeyboardEvent, useEffect, useState } from "react";
import { Search, X } from "../../components/icons/index.js";

interface PidFileTreeFilterProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when the user presses `↓` from the input — used to move focus into the tree. */
  onArrowDown?: () => void;
  placeholder?: string;
}

const DEBOUNCE_MS = 80;

/**
 * Debounced search input. Local state mirrors the keystrokes for instant feedback; the
 * upstream `onChange` only fires after the user pauses, so the (potentially expensive)
 * fuse rebuild doesn't run on every keystroke.
 *
 * `forwardRef` is used so the keyboard hook can move focus from the tree back to the
 * filter (e.g. when the user types `/` in the future).
 */
export const PidFileTreeFilter = forwardRef<HTMLInputElement, PidFileTreeFilterProps>(
  function PidFileTreeFilter({ value, onChange, onArrowDown, placeholder }, ref) {
    const [local, setLocal] = useState(value);

    // Sync local → external state with a debounce. Each keystroke restarts the timer.
    useEffect(() => {
      if (local === value) return;
      const t = setTimeout(() => onChange(local), DEBOUNCE_MS);
      return () => clearTimeout(t);
    }, [local, value, onChange]);

    // If the source-of-truth changes elsewhere (e.g. a project switch resets the filter),
    // pull that value back into local state so the input stays in sync.
    useEffect(() => {
      setLocal(value);
    }, [value]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      setLocal(e.target.value);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape" && local.length > 0) {
        e.preventDefault();
        setLocal("");
        onChange("");
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onArrowDown?.();
      }
    };

    const clear = () => {
      setLocal("");
      onChange("");
    };

    return (
      <div className="pid-tree-filter">
        <span className="pid-tree-filter-icon" aria-hidden>
          <Search size={12} />
        </span>
        <input
          ref={ref}
          type="text"
          className="pid-input pid-tree-filter-input"
          placeholder={placeholder ?? "filter files…"}
          value={local}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          aria-label="Filter files"
        />
        {local.length > 0 && (
          <button
            type="button"
            className="pid-tree-filter-clear"
            onClick={clear}
            aria-label="Clear filter"
          >
            <X size={11} />
          </button>
        )}
      </div>
    );
  },
);
