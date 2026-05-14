import type { ToolRendererProps, ToolSummarizer } from "../types.js";
import { Chip } from "./common.js";

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
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[var(--color-text-muted)]">
        <Chip>{input.path ?? "(no path)"}</Chip>
        <span>
          {edits.length} edit{edits.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="space-y-2">
        {edits.map((edit) => (
          <div
            key={`${edit.oldText ?? ""}\0${edit.newText ?? ""}`}
            className="bg-[var(--color-panel-2)] rounded-[var(--radius-sm)] p-2 font-mono text-xs"
          >
            {edit.oldText && (
              <pre className="m-0 text-[var(--color-danger)] whitespace-pre-wrap break-words">
                {edit.oldText
                  .split("\n")
                  .map((l) => `- ${l}`)
                  .join("\n")}
              </pre>
            )}
            {edit.newText && (
              <pre className="m-0 text-[var(--color-success)] whitespace-pre-wrap break-words">
                {edit.newText
                  .split("\n")
                  .map((l) => `+ ${l}`)
                  .join("\n")}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export const editSummary: ToolSummarizer = (input) => {
  const path = (input as EditInput | null)?.path;
  return { text: path };
};
