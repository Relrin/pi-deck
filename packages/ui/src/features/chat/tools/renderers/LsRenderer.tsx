import type { ToolRendererProps, ToolSummarizer } from "../types.js";
import { Chip, CodeBlock, extractTextContent } from "./common.js";

interface LsInput {
  path?: string;
}

export function LsRenderer({ call }: ToolRendererProps) {
  const input = (call.input ?? {}) as LsInput;
  const output = extractTextContent(call.result);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[var(--color-text-muted)]">
        <Chip>{input.path ?? "."}</Chip>
      </div>
      {output && <CodeBlock text={output} />}
    </div>
  );
}

export const lsSummary: ToolSummarizer = (input) => {
  const p = (input as LsInput | null)?.path;
  return { text: p ?? "." };
};
