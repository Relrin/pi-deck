import { truncateMiddle } from "../../../../lib/format/truncate.js";
import type { ToolRendererProps, ToolSummarizer } from "../types.js";
import { CodeBlock, extractTextContent } from "./common.js";

interface ReadInput {
  path?: string;
  offset?: number;
  limit?: number;
}

export function ReadRenderer({ call }: ToolRendererProps) {
  const input = (call.input ?? {}) as ReadInput;
  const text = extractTextContent(call.result) || extractTextContent(call.partialResult);
  const hasRange = input.offset !== undefined || input.limit !== undefined;
  return (
    <div className="space-y-2">
      {hasRange && (
        <div className="flex flex-wrap items-center gap-2 text-[var(--color-text-muted)] text-xs">
          {input.offset !== undefined && <span>offset {input.offset}</span>}
          {input.limit !== undefined && <span>limit {input.limit}</span>}
        </div>
      )}
      {text && <CodeBlock text={text} ariaLabel="File contents" />}
    </div>
  );
}

export const readSummary: ToolSummarizer = (input) => {
  const path = (input as ReadInput | null)?.path;
  if (!path) return {};
  return { text: truncateMiddle(path), title: path };
};
