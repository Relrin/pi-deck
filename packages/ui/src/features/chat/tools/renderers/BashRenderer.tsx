import { truncateEnd } from "../../../../lib/format/truncate.js";
import type { ToolRendererProps, ToolSummarizer } from "../types.js";
import { CodeBlock, extractTextContent } from "./common.js";

interface BashInput {
  command?: string;
  timeout?: number;
}

export function BashRenderer({ call }: ToolRendererProps) {
  const input = (call.input ?? {}) as BashInput;
  const output = extractTextContent(call.result) || extractTextContent(call.partialResult);
  return (
    <div className="space-y-2">
      <div className="rounded-[var(--radius-sm)] bg-[var(--color-panel-2)] p-2 font-mono text-xs text-[var(--color-text)] whitespace-pre-wrap break-words">
        <span className="text-[var(--color-accent)]">$</span> <span>{input.command ?? ""}</span>
      </div>
      {output && <CodeBlock text={output} ariaLabel="Bash output" />}
    </div>
  );
}

export const bashSummary: ToolSummarizer = (input) => {
  const cmd = (input as BashInput | null)?.command;
  if (!cmd) return {};
  return { text: truncateEnd(cmd), title: cmd };
};
