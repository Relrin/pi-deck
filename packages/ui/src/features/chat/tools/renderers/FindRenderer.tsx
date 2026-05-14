import type { ToolRendererProps, ToolSummarizer } from "../types.js";
import { Chip, CodeBlock, extractTextContent } from "./common.js";

interface FindInput {
  pattern?: string;
  path?: string;
}

export function FindRenderer({ call }: ToolRendererProps) {
  const input = (call.input ?? {}) as FindInput;
  const output = extractTextContent(call.result);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[var(--color-text-muted)]">
        <Chip>{input.pattern ?? ""}</Chip>
        {input.path && <span>in {input.path}</span>}
      </div>
      {output && <CodeBlock text={output} />}
    </div>
  );
}

export const findSummary: ToolSummarizer = (input) => {
  const p = (input as FindInput | null)?.pattern;
  return { text: p };
};
