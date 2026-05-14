import { truncateEnd } from "../../../../lib/format/truncate.js";
import type { ToolRendererProps, ToolSummarizer } from "../types.js";
import { Chip, CodeBlock, extractTextContent } from "./common.js";

interface FindInput {
  pattern?: string;
  path?: string;
}

export function FindRenderer({ call }: ToolRendererProps) {
  const input = (call.input ?? {}) as FindInput;
  const output = extractTextContent(call.result) || extractTextContent(call.partialResult);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[var(--color-text-muted)] text-xs">
        <Chip title={input.pattern}>{input.pattern ?? "(no pattern)"}</Chip>
        {input.path && <span>in {input.path}</span>}
      </div>
      {output && <CodeBlock text={output} ariaLabel="Find results" />}
    </div>
  );
}

export const findSummary: ToolSummarizer = (input) => {
  const p = (input as FindInput | null)?.pattern;
  if (!p) return {};
  return { text: truncateEnd(p), title: p };
};
