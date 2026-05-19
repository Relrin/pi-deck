import { useState } from "react";
import { cn } from "../../../../lib/cn.js";
import { EDIT_RENDERER_COLLAPSED_EDITS } from "../../../../lib/ui-constants.js";
import type { ToolRendererProps, ToolSummarizer } from "../types.js";

interface EditEntry {
  oldText?: string;
  newText?: string;
}

interface EditInput {
  path?: string;
  edits?: EditEntry[];
}

export function EditRenderer({ call }: ToolRendererProps) {
  const input = (call.input ?? {}) as EditInput;
  const edits = Array.isArray(input.edits) ? input.edits : [];
  const [showAll, setShowAll] = useState(false);
  const visible =
    showAll || edits.length <= EDIT_RENDERER_COLLAPSED_EDITS
      ? edits
      : edits.slice(0, EDIT_RENDERER_COLLAPSED_EDITS);

  return (
    <div className="space-y-2">
      <div className="text-[var(--color-text-muted)] text-xs">
        {edits.length} edit{edits.length === 1 ? "" : "s"}
      </div>
      <div className="space-y-2">
        {visible.map((edit, idx) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: edits are positional and not user-sortable
            key={idx}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] overflow-hidden font-mono text-xs"
          >
            {edit.oldText !== undefined && edit.oldText.length > 0 && (
              <DiffRow kind="old" text={edit.oldText} />
            )}
            {edit.newText !== undefined && edit.newText.length > 0 && (
              <DiffRow kind="new" text={edit.newText} />
            )}
          </div>
        ))}
      </div>
      {!showAll && edits.length > EDIT_RENDERER_COLLAPSED_EDITS && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-[var(--radius-sm)] px-1"
        >
          Show all {edits.length} edits
        </button>
      )}
    </div>
  );
}

function DiffRow({ kind, text }: { kind: "old" | "new"; text: string }) {
  const lines = text.split("\n");
  return (
    <div
      className={cn(
        "flex",
        kind === "old"
          ? "bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)]"
          : "bg-[color-mix(in_oklab,var(--color-success)_12%,transparent)]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "w-6 shrink-0 select-none border-r border-[var(--color-border)] py-1.5 text-center",
          kind === "old" ? "text-[var(--color-danger)]" : "text-[var(--color-success)]",
        )}
      >
        {kind === "old" ? "-" : "+"}
      </span>
      <pre
        className={cn(
          "m-0 flex-1 px-2 py-1.5 whitespace-pre overflow-x-auto",
          kind === "old" ? "text-[var(--color-danger)]" : "text-[var(--color-success)]",
        )}
      >
        {lines.join("\n")}
      </pre>
    </div>
  );
}

export const editSummary: ToolSummarizer = (input) => {
  const path = (input as EditInput | null)?.path;
  return { text: path };
};
