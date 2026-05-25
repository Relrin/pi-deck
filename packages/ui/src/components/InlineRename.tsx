import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";

export interface InlineRenameProps {
  initialValue: string;
  /** Called with the trimmed new value when Enter or blur commits. Skipped if unchanged. */
  onSave: (value: string) => void;
  /** Called on Escape or after onSave returns; the caller uses this to leave editing mode. */
  onCancel: () => void;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
}

/**
 * Inline text editor that swaps in when the user wants to rename a label in-place.
 * Used by the rail row's right-click → Rename and by the chat header's double-click on
 * the session title.
 *
 * Behaviour:
 *  - Enter / blur → commit (calls `onSave` only if the trimmed value differs)
 *  - Escape → cancel (no save)
 *  - Click on the input does NOT bubble to the parent (so wrapping rows / titles don't
 *    re-trigger their own click handlers).
 *
 * Focus + select-all are scheduled in a `requestAnimationFrame` so they win the race
 * against Radix Context/Dropdown focus restoration after a menu item is selected —
 * without the rAF, Radix sometimes hands focus back to the trigger button and the user
 * has to manually highlight the text before typing.
 */
export function InlineRename({
  initialValue,
  onSave,
  onCancel,
  className,
  inputClassName,
  ariaLabel,
}: InlineRenameProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);
  const interactedRef = useRef(false);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.focus();
      el.select();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const commit = (next: string) => {
    if (committedRef.current) return;
    committedRef.current = true;
    const trimmed = next.trim();
    if (trimmed && trimmed !== initialValue) onSave(trimmed);
    onCancel();
  };

  const cancel = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    interactedRef.current = true;
    commit(value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    interactedRef.current = true;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    }
  };

  const onBlur = () => {
    // Ignore the synthetic blur that comes from focus-restoration races on mount; only
    // commit when the user has truly interacted with the field.
    if (!interactedRef.current) return;
    commit(value);
  };

  return (
    <form className={className} onSubmit={onSubmit}>
      <input
        ref={inputRef}
        type="text"
        className={inputClassName}
        value={value}
        onChange={(e) => {
          interactedRef.current = true;
          setValue(e.target.value);
        }}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        // Swallow click so the surrounding row / title doesn't re-trigger its own onClick
        // (activate session, open menu, etc.) while the user is positioning the caret.
        onClick={(e) => {
          interactedRef.current = true;
          e.stopPropagation();
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label={ariaLabel}
      />
    </form>
  );
}
