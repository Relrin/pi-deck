import { truncateEnd } from "../../../../lib/format/truncate.js";
import type { ToolRendererProps, ToolSummarizer } from "../types.js";
import { CodeBlock, extractTextContent } from "./common.js";

interface GrepInput {
  pattern?: string;
  path?: string;
  glob?: string;
  ignoreCase?: boolean;
  literal?: boolean;
  context?: number;
  limit?: number;
}

export function GrepRenderer({ call }: ToolRendererProps) {
  const input = (call.input ?? {}) as GrepInput;
  const output = extractTextContent(call.result) || extractTextContent(call.partialResult);
  // Header already shows GREP + "pattern"; repeat only the secondary options.
  const hasOptions = input.path || input.glob || input.ignoreCase || input.literal;
  return (
    <div className="space-y-2">
      {hasOptions && (
        <div className="flex flex-wrap items-center gap-2 text-[var(--color-text-muted)] text-xs">
          {input.path && <span>in {input.path}</span>}
          {input.glob && <span>glob {input.glob}</span>}
          {input.ignoreCase && <span>case-insensitive</span>}
          {input.literal && <span>literal</span>}
        </div>
      )}
      {output && <CodeBlock text={output} ariaLabel="Grep matches" />}
    </div>
  );
}

export const grepSummary: ToolSummarizer = (input) => {
  const p = (input as GrepInput | null)?.pattern;
  if (!p) return {};
  return { text: `"${truncateEnd(p)}"`, title: p };
};
