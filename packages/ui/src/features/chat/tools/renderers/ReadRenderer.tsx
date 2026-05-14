import type { ToolRendererProps, ToolSummarizer } from "../types.js";
import { Chip, CodeBlock, extractTextContent } from "./common.js";

interface ReadInput {
  path?: string;
  offset?: number;
  limit?: number;
}

export function ReadRenderer({ call }: ToolRendererProps) {
  const input = (call.input ?? {}) as ReadInput;
  const text = extractTextContent(call.result);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[var(--color-text-muted)]">
        <Chip>{input.path ?? "(no path)"}</Chip>
        {input.offset !== undefined && <span>offset {input.offset}</span>}
        {input.limit !== undefined && <span>limit {input.limit}</span>}
      </div>
      {text && <CodeBlock text={text} />}
    </div>
  );
}

export const readSummary: ToolSummarizer = (input) => {
  const path = (input as ReadInput | null)?.path;
  return { text: path };
};
