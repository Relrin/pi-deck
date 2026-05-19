import { truncateMiddle } from "../../../../lib/format/truncate.js";
import type { ToolRendererProps, ToolSummarizer } from "../types.js";
import { CodeBlock, extractTextContent } from "./common.js";

interface LsInput {
  path?: string;
}

export function LsRenderer({ call }: ToolRendererProps) {
  const output = extractTextContent(call.result) || extractTextContent(call.partialResult);
  // Header already shows "LS · <path>" — no need to repeat the path here.
  return (
    <div className="space-y-2">
      {output && <CodeBlock text={output} ariaLabel="Directory listing" />}
    </div>
  );
}

export const lsSummary: ToolSummarizer = (input) => {
  const p = (input as LsInput | null)?.path ?? ".";
  return { text: truncateMiddle(p), title: p };
};
