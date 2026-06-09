import { useEffect, useState } from "react";
import { PidButton } from "../../components/buttons/PidButton.js";
import { Dialog } from "../../components/ui/Dialog.js";
import { gotoLineColumn } from "./editorViewBridge.js";

interface PidGotoLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current caret position — used to pre-fill the input. */
  line: number;
  col: number;
}

/** Accepts `line` or `line:column`; column defaults to 1. Returns null on anything else. */
function parseTarget(value: string): { line: number; col: number } | null {
  const m = /^\s*(\d+)\s*(?::\s*(\d+))?\s*$/.exec(value);
  if (!m?.[1]) return null;
  return { line: Number.parseInt(m[1], 10), col: m[2] ? Number.parseInt(m[2], 10) : 1 };
}

/**
 * "Go to Line:Column" modal opened from the footer's cursor segment. Submitting drives the
 * mounted CodeMirror view via `gotoLineColumn` (out-of-range values are clamped there).
 */
export function PidGotoLineDialog({ open, onOpenChange, line, col }: PidGotoLineDialogProps) {
  const [value, setValue] = useState(`${line}:${col}`);

  // Re-seed the field at the current caret each time the dialog opens.
  useEffect(() => {
    if (open) setValue(`${line}:${col}`);
  }, [open, line, col]);

  const submit = () => {
    const target = parseTarget(value);
    if (target) gotoLineColumn(target.line, target.col);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Go to Line:Column"
      description="Enter a line number, or line:column."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          autoFocus
          className="pid-goto-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 120 or 120:8"
          inputMode="numeric"
          aria-label="Line and column"
        />
        <div className="mt-4 flex justify-end gap-2">
          <PidButton variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </PidButton>
          <PidButton variant="primary" type="submit">
            Go
          </PidButton>
        </div>
      </form>
    </Dialog>
  );
}
