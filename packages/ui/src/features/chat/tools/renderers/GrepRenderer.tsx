import type { ToolRendererProps, ToolSummarizer } from "../types.js";
import { Chip, CodeBlock, extractTextContent } from "./common.js";

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
  const output = extractTextContent(call.result);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[var(--color-text-muted)]">
        <Chip>{input.pattern ?? ""}</Chip>
        {input.path && <span>in {input.path}</span>}
        {input.glob && <span>glob {input.glob}</span>}
      </div>
      {output && <CodeBlock text={output} />}
    </div>
  );
}

export const grepSummary: ToolSummarizer = (input) => {
  const p = (input as GrepInput | null)?.pattern;
  return { text: p ? `"${p}"` : undefined };
};
